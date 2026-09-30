#import <Cocoa/Cocoa.h>
#import <Sparkle/Sparkle.h>
#include <node_api.h>
#include <string>

// Sparkle owns discovery, signature verification, installation, and relaunch.
// This driver mirrors Donkey Cut's windowless, click-to-install update flow.
static napi_threadsafe_function callback = nullptr;

@interface DonkeyDiffUpdater : NSObject <SPUUserDriver, SPUUpdaterDelegate>
@property(nonatomic, strong) SPUUpdater *updater;
@property(nonatomic, copy) void (^pendingInstall)(SPUUserUpdateChoice);
@property(nonatomic, copy) NSString *latestVersion;
@property(nonatomic) BOOL stopped;
- (void)start;
- (void)check;
- (void)install;
- (void)emit:(NSString *)status message:(NSString *)message;
@end

@implementation DonkeyDiffUpdater
- (void)emit:(NSString *)status message:(NSString *)message {
  if (self.stopped || !callback) return;
  NSMutableDictionary *state = [@{
    @"status": status,
    @"currentVersion": [NSBundle.mainBundle objectForInfoDictionaryKey:@"CFBundleShortVersionString"] ?: @""
  } mutableCopy];
  if (self.latestVersion) state[@"latestVersion"] = self.latestVersion;
  if (message) state[@"message"] = message;
  NSData *json = [NSJSONSerialization dataWithJSONObject:state options:0 error:nil];
  auto *payload = new std::string((const char *)json.bytes, json.length);
  if (napi_call_threadsafe_function(callback, payload, napi_tsfn_nonblocking) != napi_ok) delete payload;
}
- (void)start {
  NSBundle *bundle = NSBundle.mainBundle;
  NSString *feed = [bundle objectForInfoDictionaryKey:@"SUFeedURL"];
  NSString *key = [bundle objectForInfoDictionaryKey:@"SUPublicEDKey"];
  if (!feed.length || !key.length) {
    [self emit:@"unavailable" message:@"This build has no update feed configured."];
    return;
  }
  self.updater = [[SPUUpdater alloc] initWithHostBundle:bundle applicationBundle:bundle userDriver:self delegate:self];
  NSError *error = nil;
  if (![self.updater startUpdater:&error]) {
    [self emit:@"unavailable" message:error.localizedDescription];
    self.updater = nil;
    return;
  }
  [self emit:@"notChecked" message:nil];
  [self.updater checkForUpdatesInBackground];
}
- (void)check {
  if (!self.updater || !self.updater.canCheckForUpdates) return;
  self.latestVersion = nil;
  [self emit:@"checking" message:nil];
  [self.updater checkForUpdates];
}
- (void)install {
  if (!self.pendingInstall) { [self check]; return; }
  void (^reply)(SPUUserUpdateChoice) = self.pendingInstall;
  self.pendingInstall = nil;
  [self emit:@"installing" message:nil];
  reply(SPUUserUpdateChoiceInstall);
}
- (void)showUpdatePermissionRequest:(SPUUpdatePermissionRequest *)request reply:(void (^)(SUUpdatePermissionResponse *))reply {
  reply([[SUUpdatePermissionResponse alloc] initWithAutomaticUpdateChecks:YES automaticUpdateDownloading:@NO sendSystemProfile:NO]);
}
- (void)showUserInitiatedUpdateCheckWithCancellation:(void (^)(void))cancellation {}
- (void)showUpdateFoundWithAppcastItem:(SUAppcastItem *)item state:(SPUUserUpdateState *)state reply:(void (^)(SPUUserUpdateChoice))reply {
  self.latestVersion = item.displayVersionString;
  if (item.informationOnlyUpdate) {
    reply(SPUUserUpdateChoiceDismiss);
    [self emit:@"unavailable" message:@"This update requires a manual download from the releases page."];
  } else if (![NSFileManager.defaultManager isWritableFileAtPath:NSBundle.mainBundle.bundlePath]) {
    reply(SPUUserUpdateChoiceDismiss);
    [self emit:@"requiresAdmin" message:@"An administrator must update this app."];
  } else {
    self.pendingInstall = reply;
    [self emit:@"available" message:nil];
  }
}
- (void)showUpdateReleaseNotesWithDownloadData:(SPUDownloadData *)data {}
- (void)showUpdateReleaseNotesFailedToDownloadWithError:(NSError *)error {}
- (void)showUpdateNotFoundWithError:(NSError *)error acknowledgement:(void (^)(void))acknowledgement {
  [self emit:@"upToDate" message:nil];
  acknowledgement();
}
- (void)showUpdaterError:(NSError *)error acknowledgement:(void (^)(void))acknowledgement {
  self.pendingInstall = nil;
  [self emit:@"failed" message:error.localizedDescription];
  acknowledgement();
}
- (void)showDownloadInitiatedWithCancellation:(void (^)(void))cancellation {}
- (void)showDownloadDidReceiveExpectedContentLength:(uint64_t)length {}
- (void)showDownloadDidReceiveDataOfLength:(uint64_t)length {}
- (void)showDownloadDidStartExtractingUpdate {}
- (void)showExtractionReceivedProgress:(double)progress {}
- (void)showReadyToInstallAndRelaunch:(void (^)(SPUUserUpdateChoice))reply { reply(SPUUserUpdateChoiceInstall); }
- (void)showInstallingUpdateWithApplicationTerminated:(BOOL)terminated retryTerminatingApplication:(void (^)(void))retry {}
- (void)showUpdateInstalledAndRelaunched:(BOOL)relaunched acknowledgement:(void (^)(void))acknowledgement { acknowledgement(); }
- (void)dismissUpdateInstallation { self.pendingInstall = nil; }
- (void)updater:(SPUUpdater *)updater didAbortWithError:(NSError *)error {
  self.pendingInstall = nil;
  if ([error.domain isEqualToString:SUSparkleErrorDomain] && error.code == SUNoUpdateError) {
    [self emit:@"upToDate" message:nil];
  } else {
    [self emit:@"failed" message:error.localizedDescription];
  }
}
@end

static DonkeyDiffUpdater *driver;
static void Deliver(napi_env env, napi_value function, void *, void *data) {
  auto *payload = static_cast<std::string *>(data);
  if (env && function) {
    napi_value value, receiver, result;
    napi_create_string_utf8(env, payload->data(), payload->size(), &value);
    napi_get_undefined(env, &receiver);
    napi_call_function(env, receiver, function, 1, &value, &result);
  }
  delete payload;
}
static void Cleanup(void *) {
  driver.stopped = YES;
  if (callback) {
    napi_release_threadsafe_function(callback, napi_tsfn_abort);
    callback = nullptr;
  }
}
static napi_value Start(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1], name, result;
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
  napi_valuetype type;
  if (argc != 1 || napi_typeof(env, args[0], &type) != napi_ok || type != napi_function) {
    napi_throw_type_error(env, nullptr, "start requires a status callback");
    return nullptr;
  }
  if (!driver) {
    napi_create_string_utf8(env, "Sparkle updates", NAPI_AUTO_LENGTH, &name);
    if (napi_create_threadsafe_function(env, args[0], nullptr, name, 0, 1, nullptr, nullptr, nullptr, Deliver, &callback) != napi_ok) {
      napi_throw_error(env, nullptr, "Could not initialize Sparkle status delivery");
      return nullptr;
    }
    napi_unref_threadsafe_function(env, callback);
    napi_add_env_cleanup_hook(env, Cleanup, nullptr);
    driver = [DonkeyDiffUpdater new];
    dispatch_async(dispatch_get_main_queue(), ^{ [driver start]; });
  }
  napi_get_undefined(env, &result);
  return result;
}
static napi_value Check(napi_env env, napi_callback_info info) {
  dispatch_async(dispatch_get_main_queue(), ^{ [driver check]; });
  napi_value result; napi_get_undefined(env, &result); return result;
}
static napi_value Install(napi_env env, napi_callback_info info) {
  dispatch_async(dispatch_get_main_queue(), ^{ [driver install]; });
  napi_value result; napi_get_undefined(env, &result); return result;
}
static napi_value Init(napi_env env, napi_value exports) {
  napi_property_descriptor methods[] = {
    {"start", nullptr, Start, nullptr, nullptr, nullptr, napi_default, nullptr},
    {"check", nullptr, Check, nullptr, nullptr, nullptr, napi_default, nullptr},
    {"install", nullptr, Install, nullptr, nullptr, nullptr, napi_default, nullptr},
  };
  napi_define_properties(env, exports, 3, methods);
  return exports;
}
NAPI_MODULE(sparkle, Init)
