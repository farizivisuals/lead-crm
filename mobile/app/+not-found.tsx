// Required for the root SessionGate redirect to ever run on a cold boot to a bare `/`.
// Without this file, expo-router's getStateFromPath() returns undefined for an
// unmatched "/" (our tree has no root index route — only groups), so
// NavigationContainer never establishes navigation state and app/_layout.tsx's
// SessionGate never mounts: the user is stuck on Expo Router's built-in Unmatched
// Route screen forever, and the auth redirect in _layout.tsx never fires. With this
// file present, "/" resolves to the +not-found screen (briefly, invisibly — it
// renders null), SessionGate mounts as its parent layout, and its effect redirects
// to /login (or the employee/client shell) immediately. Verified via cold-boot in
// the iOS Simulator — see task-4-report.md.
export default function NotFound() {
  return null;
}
