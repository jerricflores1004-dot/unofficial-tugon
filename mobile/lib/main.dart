import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';
import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'core/api.dart';
import 'core/models.dart';
import 'core/offline_queue.dart';
import 'core/theme.dart';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'core/push.dart';
import 'field/field_home.dart';

final supabaseProvider = Provider<SupabaseClient>((ref) => Supabase.instance.client);
final apiProvider = Provider<TugonApi>((ref) => TugonApi(ref.watch(supabaseProvider)));
final queueProvider = Provider<OfflineReportQueue>((ref) => OfflineReportQueue());

// Every provider below reads live rows from Supabase. Nothing in this app
// renders a fixed sample record.
final incidentsProvider =
    FutureProvider.autoDispose((ref) => ref.watch(apiProvider).myIncidents());
final notificationsProvider =
    FutureProvider.autoDispose((ref) => ref.watch(apiProvider).myNotifications());
final announcementsProvider =
    FutureProvider.autoDispose((ref) => ref.watch(apiProvider).announcements());
final incidentTypesProvider =
    FutureProvider.autoDispose((ref) => ref.watch(apiProvider).incidentTypes());
final queuedReportsProvider =
    FutureProvider.autoDispose((ref) => ref.watch(queueProvider).read());
final photoLimitProvider = FutureProvider.autoDispose(
    (ref) => ref.watch(apiProvider).numericSetting('max_incident_photos', 5));
final profileProvider =
FutureProvider.autoDispose((ref) => ref.watch(apiProvider).myProfile());

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    debugPrint('STEP 1: Loading environment');

    const defineUrl = String.fromEnvironment('SUPABASE_URL');
    const defineKey = String.fromEnvironment('SUPABASE_ANON_KEY');

    late String supabaseUrl;
    late String supabaseKey;

    if (kIsWeb) {
      supabaseUrl = defineUrl.trim();
      supabaseKey = defineKey.trim();
    } else {
      await dotenv.load(fileName: '.env');

      supabaseUrl = (defineUrl.isNotEmpty
          ? defineUrl
          : dotenv.env['SUPABASE_URL'] ?? '')
          .trim();

      supabaseKey = (defineKey.isNotEmpty
          ? defineKey
          : dotenv.env['SUPABASE_ANON_KEY'] ?? '')
          .trim();
    }

    debugPrint('SUPABASE URL RAW: [$supabaseUrl]');
    debugPrint('SUPABASE URL LENGTH: ${supabaseUrl.length}');
    debugPrint('SUPABASE URL CODE UNITS: ${supabaseUrl.codeUnits}');
    debugPrint('SUPABASE KEY LENGTH: ${supabaseKey.length}');

    if (supabaseUrl.isEmpty || supabaseKey.isEmpty) {
      throw Exception(
        'Missing Supabase configuration. '
            'Check SUPABASE_URL and SUPABASE_ANON_KEY.',
      );
    }

    debugPrint('STEP 2: Checking Supabase configuration');

    debugPrint('URL exists: ${supabaseUrl.isNotEmpty}');
    debugPrint('KEY exists: ${supabaseKey.isNotEmpty}');

    debugPrint('RAW SUPABASE URL: [$supabaseUrl]');
    debugPrint('RAW URL LENGTH: ${supabaseUrl.length}');

    final parsedUrl = Uri.tryParse(supabaseUrl);

    debugPrint('URL valid: ${parsedUrl != null && parsedUrl.hasAuthority}');
    debugPrint('URL scheme: ${parsedUrl?.scheme}');
    debugPrint('URL host: ${parsedUrl?.host}');

    if (supabaseUrl.isEmpty || supabaseKey.isEmpty) {
      throw Exception('Supabase URL or key is missing.');
    }

    if (parsedUrl == null ||
        parsedUrl.scheme != 'https' ||
        parsedUrl.host.isEmpty) {
      throw Exception('Supabase URL is invalid.');
    }

    debugPrint('STEP 2.1: Starting Supabase SDK');

    try {
      debugPrint('SUPABASE URL: $supabaseUrl');
      debugPrint('SUPABASE KEY LENGTH: ${supabaseKey.length}');
      debugPrint('SUPABASE URL HOST: ${Uri.parse(supabaseUrl).host}');

      await Supabase.initialize(
        url: supabaseUrl,
        publishableKey: supabaseKey,
      );

      debugPrint('SUPABASE INITIALIZATION SUCCESS!');
    } catch (e, stack) {
      debugPrint('SUPABASE INITIALIZATION FAILED: $e');
      debugPrint('ERROR TYPE: ${e.runtimeType}');
      debugPrintStack(stackTrace: stack);
      rethrow;
    } catch (e, stack) {
      debugPrint('SUPABASE SDK ERROR: $e');
      debugPrintStack(stackTrace: stack);
      rethrow;
    }

    debugPrint('STEP 3: Initializing Firebase');

    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );

    debugPrint('STEP 4: Running application');

    runApp(const ProviderScope(child: TugonApp()));
  } catch (e, stack) {
    debugPrint('STARTUP ERROR: $e');
    debugPrintStack(stackTrace: stack);

    runApp(
      MaterialApp(
        home: Scaffold(
          body: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                'TUGON startup error:\n$e',
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class TugonApp extends ConsumerWidget {
  const TugonApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = GoRouter(
      refreshListenable:
          GoRouterRefreshStream(Supabase.instance.client.auth.onAuthStateChange),
      redirect: (_, state) {
        final signedIn = Supabase.instance.client.auth.currentSession != null;
        if (!signedIn && state.matchedLocation != '/login') return '/login';
        if (signedIn && state.matchedLocation == '/login') return '/';
        return null;
      },
      routes: [
        GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
        GoRoute(path: '/', builder: (_, __) => const RoleGate()),
        GoRoute(path: '/report', builder: (_, __) => const ReportScreen()),
        GoRoute(path: '/reports', builder: (_, __) => const ReportsScreen()),
        GoRoute(path: '/notifications', builder: (_, __) => const NotificationsScreen()),
        GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
      ],
    );
    return MaterialApp.router(
      title: 'TUGON',
      theme: tugonTheme(Brightness.light),
      darkTheme: tugonTheme(Brightness.dark),
      themeMode: ThemeMode.system,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }
}

class GoRouterRefreshStream extends ChangeNotifier {
  GoRouterRefreshStream(Stream<dynamic> stream) {
    stream.listen((_) => notifyListeners());
  }
}

/// Sends each signed-in account to the right experience for its role.
class RoleGate extends ConsumerWidget {
  const RoleGate({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(profileProvider);
    return profile.when(
        loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
        error: (_, __) => GateMessage(
            icon: Icons.cloud_off_outlined,
            title: 'Unable to load your account',
            body: 'Check your connection and try again.',
            onRetry: () => ref.invalidate(profileProvider)),
        data: (p) {
          if (p != null && p.isActive) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              PushService.start(ref.read(supabaseProvider),
                  onMessage: () => ref.invalidate(notificationsProvider));
            });
          }
          if (p == null || !p.isActive) {
            return const GateMessage(
                icon: Icons.lock_outline,
                title: 'No active profile',
                body: 'Your account has no active TUGON profile. Contact the TUGON system administrator.');
          }
          switch (p.role) {
            case 'resident':
              return const HomeScreen();
            case 'staff':
              return FieldHomeScreen(profile: p);
            default:
              return const GateMessage(
                  icon: Icons.desktop_windows_outlined,
                  title: 'Use the web portal',
                  body: 'Admin and agency accounts work in the TUGON web portal at unofficial-tugon.vercel.app.');
          }
        });
  }
}

class GateMessage extends ConsumerWidget {
  const GateMessage(
      {super.key, required this.icon, required this.title, required this.body, this.onRetry});
  final IconData icon;
  final String title;
  final String body;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
      body: SafeArea(
          child: Center(
              child: Padding(
                  padding: const EdgeInsets.all(28),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    const LogoMark(large: true),
                    const SizedBox(height: 32),
                    Icon(icon, size: 44, color: TugonColors.blue),
                    const SizedBox(height: 16),
                    Text(title,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            color: TugonColors.navy)),
                    const SizedBox(height: 8),
                    Text(body,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: TugonColors.muted, height: 1.4)),
                    const SizedBox(height: 24),
                    if (onRetry != null)
                      FilledButton(onPressed: onRetry, child: const Text('Try again')),
                    const SizedBox(height: 10),
                    OutlinedButton(
                        onPressed: () => ref.read(supabaseProvider).auth.signOut(),
                        child: const Text('Sign out'))
                  ])))));
}

/// First version of the MDRRMO field-staff screen: identity plus the
/// notifications the admin sends. Assignments come with the roster rework.
class StaffHomeScreen extends ConsumerWidget {
  const StaffHomeScreen({super.key, required this.profile});
  final AppProfile profile;

  String get _team => profile.team == null
      ? 'MDRRMO field staff'
      : 'MDRRMO · Team ${profile.team![0].toUpperCase()}${profile.team!.substring(1)}';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final feed = ref.watch(notificationsProvider);
    return Scaffold(
        appBar: AppBar(
            title: const Text('Field staff', style: TextStyle(fontWeight: FontWeight.w800)),
            actions: [
              IconButton(
                  tooltip: 'Sign out',
                  onPressed: () => ref.read(supabaseProvider).auth.signOut(),
                  icon: const Icon(Icons.logout))
            ]),
        body: RefreshIndicator(
            onRefresh: () async => ref.invalidate(notificationsProvider),
            child: ListView(padding: const EdgeInsets.fromLTRB(20, 16, 20, 30), children: [
              Text(profile.fullName.isEmpty ? 'Field staff' : profile.fullName,
                  style: const TextStyle(
                      fontSize: 22, fontWeight: FontWeight.w800, color: TugonColors.navy)),
              const SizedBox(height: 4),
              Text(_team, style: const TextStyle(color: TugonColors.muted)),
              const SizedBox(height: 22),
              const Text('Notifications from the MDRRMO',
                  style: TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w800, color: TugonColors.navy)),
              const SizedBox(height: 10),
              feed.when(
                  loading: () => const Padding(
                      padding: EdgeInsets.all(20), child: LinearProgressIndicator()),
                  error: (_, __) => const Card(
                      child: Padding(
                          padding: EdgeInsets.all(16),
                          child: Text('Notifications could not be loaded. Pull to retry.'))),
                  data: (items) => items.isEmpty
                      ? const Card(
                      child: Padding(
                          padding: EdgeInsets.all(18),
                          child: Text('No notifications yet. Assignments will appear here.',
                              style: TextStyle(color: TugonColors.muted, fontSize: 12))))
                      : Column(
                      children: items
                          .map((item) => NotificationTile(notification: item))
                          .toList()))
            ])));
  }
}

/// Formats a database timestamp without pulling in another package.
String relativeTimestamp(DateTime? at) {
  if (at == null) return '';
  final local = at.toLocal();
  final diff = DateTime.now().difference(local);
  if (diff.inMinutes < 1) return 'Just now';
  if (diff.inMinutes < 60) return '${diff.inMinutes} min ago';
  if (diff.inHours < 24) return '${diff.inHours} hr ago';
  if (diff.inDays < 7) return '${diff.inDays} d ago';
  return '${local.year}-${local.month.toString().padLeft(2, '0')}-${local.day.toString().padLeft(2, '0')}';
}

class LogoMark extends StatelessWidget {
  const LogoMark({super.key, this.large = false});
  final bool large;

  @override
  Widget build(BuildContext context) => Row(children: [
        Container(
            width: large ? 46 : 38,
            height: large ? 46 : 38,
            decoration: BoxDecoration(
                color: TugonColors.navy, borderRadius: BorderRadius.circular(13)),
            child: const Icon(Icons.shield_outlined, color: Colors.white)),
        const SizedBox(width: 10),
        const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('TUGON',
              style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 3,
                  color: TugonColors.navy)),
          Text('MDRRMO MABINI',
              style: TextStyle(
                  fontSize: 9,
                  letterSpacing: 1.2,
                  color: TugonColors.muted,
                  fontWeight: FontWeight.w700))
        ]),
      ]);
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final email = TextEditingController();
  final password = TextEditingController();
  final fullName = TextEditingController();
  bool isSignUp = false;
  bool loading = false;
  String? error;
  String? info;

  @override
  void dispose() {
    email.dispose();
    password.dispose();
    fullName.dispose();
    super.dispose();
  }

  Future<void> submitAuth() async {
    final emailText = email.text.trim();
    final passwordText = password.text;
    final nameText = fullName.text.trim();

    if (emailText.isEmpty || passwordText.isEmpty) {
      setState(() => error = 'Please enter your email address and password.');
      return;
    }

    if (isSignUp && nameText.isEmpty) {
      setState(() => error = 'Please enter your full name to register.');
      return;
    }

    setState(() {
      loading = true;
      error = null;
      info = null;
    });

    try {
      if (isSignUp) {
        final response = await Supabase.instance.client.auth.signUp(
          email: emailText,
          password: passwordText,
          emailRedirectTo: kIsWeb
              ? 'https://unofficial-tugon.vercel.app'
              : null,
          data: {
            'full_name': nameText,
          },
        );
        if (mounted) {
          if (response.session != null) {
            setState(() => info = 'Account created and signed in successfully!');
          } else {
            setState(() => info = 'Account created! If email confirmation is enabled, please check your inbox.');
          }
        }
      } else {
        await Supabase.instance.client.auth.signInWithPassword(
          email: emailText,
          password: passwordText,
        );
      }
    } on AuthException catch (e) {
      if (mounted) setState(() => error = e.message);
    } catch (_) {
      if (mounted) {
        setState(() => error = 'Unable to reach the authentication service. Please check your network or configuration.');
      }
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
      body: SafeArea(
          child: Center(
              child: SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 420),
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const LogoMark(large: true),
                            const SizedBox(height: 52),
                            Text(isSignUp ? 'Create account' : 'Welcome back',
                                style: const TextStyle(
                                    fontSize: 30,
                                    fontWeight: FontWeight.w800,
                                    color: TugonColors.navy)),
                            const SizedBox(height: 8),
                            Text(
                                isSignUp
                                    ? 'Sign up to report and track incidents in Mabini.'
                                    : 'Sign in to report and track incidents in Mabini.',
                                style: const TextStyle(color: TugonColors.muted)),
                            const SizedBox(height: 32),
                            if (error != null)
                              Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.all(12),
                                  margin: const EdgeInsets.only(bottom: 16),
                                  decoration: BoxDecoration(
                                      color: const Color(0xFFFFF1F2),
                                      borderRadius: BorderRadius.circular(12)),
                                  child: Text(error!,
                                      style: const TextStyle(
                                          color: TugonColors.emergency, fontSize: 12))),
                            if (info != null)
                              Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.all(12),
                                  margin: const EdgeInsets.only(bottom: 16),
                                  decoration: BoxDecoration(
                                      color: const Color(0xFFECFDF5),
                                      borderRadius: BorderRadius.circular(12)),
                                  child: Text(info!,
                                      style: const TextStyle(
                                          color: TugonColors.success, fontSize: 12))),
                            if (isSignUp) ...[
                              TextField(
                                  controller: fullName,
                                  decoration: const InputDecoration(
                                      labelText: 'Full name',
                                      prefixIcon: Icon(Icons.person_outline))),
                              const SizedBox(height: 14),
                            ],
                            TextField(
                                controller: email,
                                keyboardType: TextInputType.emailAddress,
                                decoration: const InputDecoration(
                                    labelText: 'Email address',
                                    prefixIcon: Icon(Icons.mail_outline))),
                            const SizedBox(height: 14),
                            TextField(
                                controller: password,
                                obscureText: true,
                                decoration: const InputDecoration(
                                    labelText: 'Password',
                                    prefixIcon: Icon(Icons.lock_outline))),
                            const SizedBox(height: 22),
                            SizedBox(
                                width: double.infinity,
                                height: 54,
                                child: FilledButton(
                                    onPressed: loading ? null : submitAuth,
                                    style: FilledButton.styleFrom(
                                        backgroundColor: TugonColors.blue,
                                        shape: RoundedRectangleBorder(
                                            borderRadius: BorderRadius.circular(12))),
                                    child: loading
                                        ? const CircularProgressIndicator(color: Colors.white)
                                        : Text(isSignUp ? 'Sign up' : 'Sign in',
                                            style: const TextStyle(fontWeight: FontWeight.w700)))),
                            const SizedBox(height: 18),
                            Center(
                                child: TextButton(
                                    onPressed: () => setState(() {
                                          isSignUp = !isSignUp;
                                          error = null;
                                          info = null;
                                        }),
                                    child: Text(isSignUp
                                        ? 'Already have an account? Sign in'
                                        : "Don't have an account? Sign up")))
                          ]))))));
}

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(supabaseProvider).auth.currentUser;
    final name =
        user?.userMetadata?['full_name']?.toString().split(' ').first ?? 'there';
    return ResidentScaffold(
        index: 0,
        child: RefreshIndicator(
            onRefresh: () async {
              await ref.read(apiProvider).syncQueuedReports(ref.read(queueProvider));
              ref.invalidate(incidentsProvider);
              ref.invalidate(announcementsProvider);
              ref.invalidate(notificationsProvider);
              ref.invalidate(queuedReportsProvider);
            },
            child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 18, 20, 30),
                children: [
                  const LogoMark(),
                  const SizedBox(height: 28),
                  Text('Hello, $name',
                      style: const TextStyle(
                          fontSize: 23,
                          fontWeight: FontWeight.w800,
                          color: TugonColors.navy)),
                  const SizedBox(height: 4),
                  const Text('Stay informed. Stay safe.',
                      style: TextStyle(color: TugonColors.muted)),
                  const SizedBox(height: 20),
                  Container(
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                          color: TugonColors.emergency,
                          borderRadius: BorderRadius.circular(18),
                          boxShadow: const [
                            BoxShadow(
                                color: Color(0x33DC2626),
                                blurRadius: 18,
                                offset: Offset(0, 8))
                          ]),
                      child: Row(children: [
                        const Expanded(
                            child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                              Text('Need urgent help?',
                                  style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 17,
                                      fontWeight: FontWeight.w800)),
                              SizedBox(height: 5),
                              Text('Report an incident to MDRRMO Mabini.',
                                  style: TextStyle(
                                      color: Color(0xFFFFE4E6), fontSize: 12))
                            ])),
                        IconButton(
                            onPressed: () => context.push('/report'),
                            icon: const Icon(Icons.arrow_forward_rounded,
                                color: Colors.white, size: 28))
                      ])),
                  const SizedBox(height: 26),
                  Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('My reports',
                            style: TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.w800,
                                color: TugonColors.navy)),
                        TextButton(
                            onPressed: () => context.go('/reports'),
                            child: const Text('View all'))
                      ]),
                  const SizedBox(height: 4),
                  const ReportPreview(),
                  const SizedBox(height: 24),
                  const Text('Announcements',
                      style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                          color: TugonColors.navy)),
                  const SizedBox(height: 10),
                  const AnnouncementList(),
                  const SizedBox(height: 24),
                  const SyncStatusCard()
                ])));
  }
}

class ReportPreview extends ConsumerWidget {
  const ReportPreview({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reports = ref.watch(incidentsProvider);
    return reports.when(
        loading: () => const Card(
            child: Padding(padding: EdgeInsets.all(20), child: LinearProgressIndicator())),
        error: (e, _) => const Card(
            child: Padding(
                padding: EdgeInsets.all(16),
                child: Text('Reports are unavailable right now. Pull to retry.'))),
        data: (items) {
          if (items.isEmpty) {
            return const Card(
                child: Padding(
                    padding: EdgeInsets.all(18),
                    child: Text(
                        'No reports yet. Your submitted incidents will appear here.')));
          }
          return Column(
              children: items.take(2).map((item) => ReportTile(item: item)).toList());
        });
  }
}

class ReportTile extends StatelessWidget {
  const ReportTile({super.key, required this.item});
  final ResidentIncident item;

  @override
  Widget build(BuildContext context) => Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
          contentPadding: const EdgeInsets.symmetric(horizontal: 15, vertical: 4),
          leading: Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                  color: const Color(0xFFDBEAFE), borderRadius: BorderRadius.circular(11)),
              child: const Icon(Icons.campaign_outlined, color: TugonColors.blue)),
          title: Text(item.type,
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
          subtitle: Text('${item.ticketId} · ${item.barangay}',
              style: const TextStyle(fontSize: 11, color: TugonColors.muted)),
          trailing: Text(item.status.toUpperCase(),
              style: const TextStyle(
                  fontSize: 9, color: TugonColors.blue, fontWeight: FontWeight.w800))));
}

/// Renders the published announcements stored in `public.announcements`.
class AnnouncementList extends ConsumerWidget {
  const AnnouncementList({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final announcements = ref.watch(announcementsProvider);
    return announcements.when(
        loading: () => const Card(
            child: Padding(padding: EdgeInsets.all(18), child: LinearProgressIndicator())),
        error: (_, __) => const Card(
            child: Padding(
                padding: EdgeInsets.all(16),
                child: Text('Announcements could not be loaded. Pull to retry.'))),
        data: (items) {
          if (items.isEmpty) {
            return const Card(
                child: Padding(
                    padding: EdgeInsets.all(16),
                    child: Text('No published announcements right now.',
                        style: TextStyle(color: TugonColors.muted, fontSize: 12))));
          }
          return Column(
              children: items
                  .take(3)
                  .map((item) => AnnouncementCard(announcement: item))
                  .toList());
        });
  }
}

class AnnouncementCard extends StatelessWidget {
  const AnnouncementCard({super.key, required this.announcement});
  final ResidentAnnouncement announcement;

  Color get _accent => announcement.priority == 'urgent'
      ? TugonColors.emergency
      : announcement.priority == 'important'
          ? const Color(0xFFD97706)
          : TugonColors.blue;

  Color get _tint => announcement.priority == 'urgent'
      ? const Color(0xFFFFF1F2)
      : announcement.priority == 'important'
          ? const Color(0xFFFEF3C7)
          : const Color(0xFFDBEAFE);

  IconData get _icon => announcement.priority == 'urgent'
      ? Icons.warning_amber_rounded
      : Icons.info_outline;

  @override
  Widget build(BuildContext context) => Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
          padding: const EdgeInsets.all(15),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                    color: _tint,
                    borderRadius: BorderRadius.circular(10)),
                child: Icon(_icon, color: _accent)),
            const SizedBox(width: 12),
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Text(announcement.title,
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, color: TugonColors.navy)),
                  const SizedBox(height: 5),
                  Text(announcement.body,
                      style: const TextStyle(
                          fontSize: 12, color: TugonColors.muted, height: 1.4)),
                  const SizedBox(height: 6),
                  Text(
                      '${announcement.priority.toUpperCase()} · ${relativeTimestamp(announcement.publishedAt)}',
                      style: const TextStyle(
                          fontSize: 10,
                          letterSpacing: 0.6,
                          fontWeight: FontWeight.w700,
                          color: TugonColors.muted))
                ]))
          ])));
}

/// Reports the real state of the local offline queue against the database.
class SyncStatusCard extends ConsumerWidget {
  const SyncStatusCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final queued = ref.watch(queuedReportsProvider);
    final pending = queued.asData?.value.length ?? 0;
    final color = pending > 0 ? const Color(0xFFD97706) : TugonColors.success;
    final background = pending > 0 ? const Color(0xFFFEF3C7) : const Color(0xFFD1FAE5);
    return Container(
        padding: const EdgeInsets.all(15),
        decoration:
            BoxDecoration(color: background, borderRadius: BorderRadius.circular(14)),
        child: Row(children: [
          Icon(pending > 0 ? Icons.sync_problem : Icons.wifi, color: color),
          const SizedBox(width: 10),
          Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(queued.isLoading ? 'CHECKING' : pending > 0 ? '$pending WAITING' : 'SYNCED',
                style: TextStyle(
                    color: color, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 1)),
            Text(
                queued.isLoading
                    ? 'Reading the offline queue…'
                    : pending > 0
                        ? 'Pull to refresh to send them to MDRRMO.'
                        : 'Every report is stored in the database.',
                style: TextStyle(color: color, fontSize: 12))
          ])),
          if (pending > 0)
            TextButton(
                onPressed: () async {
                  final synced = await ref
                      .read(apiProvider)
                      .syncQueuedReports(ref.read(queueProvider));
                  ref.invalidate(incidentsProvider);
                  ref.invalidate(queuedReportsProvider);
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                        content: Text(synced > 0
                            ? '$synced queued report(s) sent to MDRRMO.'
                            : 'Still offline. The queue is kept on this device.')));
                  }
                },
                child: const Text('Sync now'))
        ]));
  }
}

class ReportScreen extends ConsumerStatefulWidget {
  const ReportScreen({super.key});
  @override
  ConsumerState<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends ConsumerState<ReportScreen> {
  final formKey = GlobalKey<FormState>();
  final description = TextEditingController();
  final barangay = TextEditingController();
  final location = TextEditingController();
  final affectedPeople = TextEditingController(text: '0');
  final customType = TextEditingController();
  final picker = ImagePicker();

  String? selectedType;
  String severity = 'medium';
  bool saving = false;
  String? failure;
  List<XFile> photos = [];
  double? latitude;
  double? longitude;
  bool locating = false;
  String? locationNote;

  @override
  void dispose() {
    description.dispose();
    barangay.dispose();
    location.dispose();
    affectedPeople.dispose();
    customType.dispose();
    super.dispose();
  }

  Future<void> pickPhotos(int limit) async {
    try {
      final picked = await picker.pickMultiImage(imageQuality: 80, maxWidth: 1600);
      if (!mounted) return;
      final known = photos.map((p) => p.path).toSet();
      setState(() => photos = [
        ...photos,
        ...picked.where((p) => !known.contains(p.path)),
      ].take(limit).toList());
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Photos could not be selected.')));
      }
    }
  }

  Future<void> capturePhoto(int limit) async {
    if (photos.length >= limit) {
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('You can attach up to $limit photos.')));
      return;
    }
    try {
      final shot = await picker.pickImage(
          source: ImageSource.camera, imageQuality: 80, maxWidth: 1600);
      if (shot == null || !mounted) return;
      setState(() => photos = [...photos, shot]);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('The camera could not be opened.')));
      }
    }
  }

  Future<void> captureLocation() async {
    setState(() {
      locating = true;
      locationNote = null;
    });
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        setState(() => locationNote = 'Turn on location services, then try again.');
        return;
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        setState(() => locationNote =
        'Location permission was denied. You can still type the location.');
        return;
      }
      final position = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
              accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 15)));
      if (!mounted) return;
      setState(() {
        latitude = position.latitude;
        longitude = position.longitude;
      });
    } catch (_) {
      if (mounted) {
        setState(() => locationNote = 'Could not get your location. You can still type it.');
      }
    } finally {
      if (mounted) setState(() => locating = false);
    }
  }

  static const double mabiniLatMin = 13.68;
  static const double mabiniLatMax = 13.82;
  static const double mabiniLngMin = 120.87;
  static const double mabiniLngMax = 120.99;

  bool _isWithinMabini(double lat, double lng) {
    return lat >= mabiniLatMin
        && lat <= mabiniLatMax
        && lng >= mabiniLngMin
        && lng <= mabiniLngMax;
  }

  Future<void> submit(List<IncidentTypeOption> options) async {
    if (!(formKey.currentState?.validate() ?? false)) return;
    final label = options.isEmpty ? customType.text.trim() : (selectedType ?? '').trim();
    if (label.isEmpty) {
      setState(() => failure = 'Choose or type the incident type.');
      return;
    }

    // Reject GPS coordinates outside Mabini, Batangas.
    if (latitude != null && longitude != null && !_isWithinMabini(latitude!, longitude!)) {
      setState(() => failure = 'Reports are only accepted within Mabini, Batangas. Use manual location instead.');
      return;
    }

    setState(() {
      saving = true;
      failure = null;
    });

    final typedLocation = location.text.trim();
    final locationText = typedLocation.isNotEmpty
        ? typedLocation
        : (latitude != null
        ? 'GPS location (${latitude!.toStringAsFixed(5)}, ${longitude!.toStringAsFixed(5)})'
        : '');

    final payload = <String, dynamic>{
      'incident_type': label,
      'description': description.text.trim(),
      'location_text': locationText,
      'barangay': barangay.text.trim(),
      'severity': severity,
      'affected_people': int.tryParse(affectedPeople.text.trim()) ?? 0,
      'vulnerable_groups': <String>[],
      if (latitude != null && longitude != null) ...{
        'latitude': latitude,
        'longitude': longitude,
      },
    };

    // The workspace decides in the database whether offline queuing is allowed.
    var queueAllowed = true;
    try {
      queueAllowed = await ref.read(apiProvider).offlineSyncEnabled();
    } catch (_) {
      queueAllowed = true;
    }

    try {
      final api = ref.read(apiProvider);
      final result = await api.submitOrQueue(payload, ref.read(queueProvider),
          queueEnabled: queueAllowed);
      if (!mounted) return;
      var photoWarning = false;
      if (result.submitted && result.incidentId != null && photos.isNotEmpty) {
        try {
          await api.uploadPhotos(result.incidentId!, photos);
        } catch (_) {
          photoWarning = true;
        }
      }
      if (!mounted) return;
      ref.invalidate(incidentsProvider);
      ref.invalidate(queuedReportsProvider);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(!result.submitted
              ? 'OFFLINE: report saved and will sync when the connection is restored.'
              : photoWarning
                  ? 'Report submitted, but the photos could not be uploaded.'
                  : 'Report submitted to MDRRMO.')));
      if (result.submitted) context.pop();
    } catch (_) {
      if (!mounted) return;
      setState(() => failure =
          'The report could not be submitted or queued. Please try again.');
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final types = ref.watch(incidentTypesProvider);
    final options = types.asData?.value ?? <IncidentTypeOption>[];
    final photoLimit = ref.watch(photoLimitProvider).asData?.value ?? 5;

    return Scaffold(
        appBar: AppBar(
            title: const Text('Report incident',
                style: TextStyle(fontWeight: FontWeight.w800)),
            leading: IconButton(
                onPressed: () => context.pop(), icon: const Icon(Icons.arrow_back))),
        body: Form(
            key: formKey,
            child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
                children: [
                  const Text('Tell us what happened',
                      style: TextStyle(
                          fontSize: 23,
                          fontWeight: FontWeight.w800,
                          color: TugonColors.navy)),
                  const SizedBox(height: 7),
                  const Text('Provide details so our response team can act quickly.',
                      style: TextStyle(color: TugonColors.muted)),
                  const SizedBox(height: 25),
                  const SectionLabel(
                      icon: Icons.report_problem_outlined, text: 'Incident information'),
                  types.when(
                      loading: () => const Padding(
                          padding: EdgeInsets.symmetric(vertical: 12),
                          child: LinearProgressIndicator()),
                      error: (_, __) => _customTypeField(),
                      data: (items) =>
                          items.isEmpty ? _customTypeField() : _typeDropdown(items)),
                  const SizedBox(height: 14),
                  TextFormField(
                      controller: description,
                      maxLines: 4,
                      validator: (value) => value == null || value.trim().length < 10
                          ? 'Please add at least 10 characters.'
                          : null,
                      decoration: const InputDecoration(
                          labelText: 'What happened?',
                          hintText: 'Describe the situation and who needs help.')),
                  const SizedBox(height: 14),
                  TextFormField(
                      controller: affectedPeople,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                          labelText: 'People affected',
                          hintText: '0',
                          prefixIcon: Icon(Icons.groups_outlined))),
                  const SizedBox(height: 25),
                  const SectionLabel(icon: Icons.location_on_outlined, text: 'Location'),
                  TextFormField(
                      controller: barangay,
                      validator: (value) => value == null || value.trim().isEmpty
                          ? 'Barangay is required.'
                          : null,
                      decoration: const InputDecoration(
                          labelText: 'Barangay',
                          hintText: 'e.g. Pulong Niogan',
                          prefixIcon: Icon(Icons.map_outlined))),
                  const SizedBox(height: 14),
                  TextFormField(
                      controller: location,
                      validator: (value) =>
                      (value == null || value.trim().isEmpty) && latitude == null
                          ? 'Add where it happened, or tap "Use my current location".'
                          : null,
                      decoration: const InputDecoration(
                          labelText: 'Exact location (optional with GPS)',
                          hintText: 'e.g. Purok 4, near the creek',
                          prefixIcon: Icon(Icons.location_on_outlined))),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                      onPressed: saving || locating ? null : captureLocation,
                      icon: locating
                          ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2))
                          : Icon(latitude == null
                          ? Icons.my_location
                          : Icons.check_circle_outline),
                      label: Text(latitude == null
                          ? 'Use my current location'
                          : 'Location captured (${latitude!.toStringAsFixed(5)}, ${longitude!.toStringAsFixed(5)})')),
                  if (locationNote != null)
                    Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(locationNote!,
                            style: const TextStyle(fontSize: 11, color: TugonColors.muted))),
                  const SizedBox(height: 25),
                  const SectionLabel(
                      icon: Icons.priority_high_rounded, text: 'Severity'),
                  SegmentedButton<String>(
                      segments: const [
                        ButtonSegment(value: 'low', label: Text('Low')),
                        ButtonSegment(value: 'medium', label: Text('Medium')),
                        ButtonSegment(value: 'high', label: Text('High')),
                        ButtonSegment(value: 'critical', label: Text('Critical'))
                      ],
                      selected: {severity},
                      onSelectionChanged: (values) =>
                          setState(() => severity = values.first)),
                  const SizedBox(height: 10),
                  const Text(
                      'Priority is calculated by the database from severity and vulnerable groups.',
                      style:
                          TextStyle(fontSize: 11, color: TugonColors.muted, height: 1.4)),
                  const SizedBox(height: 25),
                  const SectionLabel(
                      icon: Icons.photo_camera_outlined, text: 'Photo evidence'),
                  Row(children: [
                    Expanded(
                        flex: 2,
                        child: OutlinedButton.icon(
                            onPressed: saving || photos.length >= photoLimit
                                ? null
                                : () => capturePhoto(photoLimit),
                            icon: const Icon(Icons.photo_camera_outlined),
                            label: const Text('Take photo',
                                overflow: TextOverflow.ellipsis, maxLines: 1))),
                    const SizedBox(width: 10),
                    Expanded(
                        flex: 3,
                        child: OutlinedButton.icon(
                            onPressed: saving || photos.length >= photoLimit
                                ? null
                                : () => pickPhotos(photoLimit),
                            icon: const Icon(Icons.add_a_photo_outlined),
                            label: Text(
                                photos.isEmpty
                                    ? 'Add up to $photoLimit photos'
                                    : '${photos.length} of $photoLimit selected',
                                overflow: TextOverflow.ellipsis,
                                maxLines: 1))),
                  ]),
                  if (photos.isNotEmpty)
                    Padding(
                        padding: const EdgeInsets.only(top: 10),
                        child: Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: photos
                                .map((file) => Chip(
                                    label: Text(file.name,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(fontSize: 11)),
                                    onDeleted: () => setState(
                                        () => photos.removeWhere((p) => p.path == file.path))))
                                .toList())),
                  if (failure != null)
                    Container(
                        width: double.infinity,
                        margin: const EdgeInsets.only(top: 18),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                            color: const Color(0xFFFFF1F2),
                            borderRadius: BorderRadius.circular(12)),
                        child: Text(failure!,
                            style: const TextStyle(
                                color: TugonColors.emergency, fontSize: 12))),
                  const SizedBox(height: 30),
                  SizedBox(
                      height: 54,
                      child: FilledButton.icon(
                          onPressed: saving ? null : () => submit(options),
                          icon: saving
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                      color: Colors.white, strokeWidth: 2))
                              : const Icon(Icons.send_rounded),
                          label: Text(saving ? 'Sending…' : 'Submit report')))
                ])));
  }

  Widget _typeDropdown(List<IncidentTypeOption> items) {
    if (selectedType == null || !items.any((item) => item.label == selectedType)) {
      selectedType = items.first.label;
    }
    return DropdownButtonFormField<String>(
        initialValue: selectedType,
        decoration: const InputDecoration(labelText: 'Incident type'),
        items: items
            .map((item) =>
                DropdownMenuItem(value: item.label, child: Text(item.label)))
            .toList(),
        onChanged: (value) => setState(() => selectedType = value));
  }

  Widget _customTypeField() => TextFormField(
      controller: customType,
      validator: (value) => value == null || value.trim().length < 2
          ? 'Describe the incident type.'
          : null,
      decoration: const InputDecoration(
          labelText: 'Incident type',
          hintText: 'No configured types yet — describe the incident',
          prefixIcon: Icon(Icons.category_outlined)));
}

class SectionLabel extends StatelessWidget {
  const SectionLabel({super.key, required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(children: [
        Icon(icon, size: 18, color: TugonColors.blue),
        const SizedBox(width: 8),
        Text(text,
            style: const TextStyle(
                fontWeight: FontWeight.w800, color: TugonColors.navy))
      ]));
}

class ReportsScreen extends ConsumerWidget {
  const ReportsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) => ResidentScaffold(
      index: 1,
      child: CustomScrollView(slivers: [
        const SliverAppBar(
            title: Text('My reports', style: TextStyle(fontWeight: FontWeight.w800)),
            pinned: true,
            backgroundColor: TugonColors.canvas),
        ref.watch(incidentsProvider).when(
            data: (items) => items.isEmpty
                ? const SliverFillRemaining(
                    child: Center(child: Text('No reports yet.')))
                : SliverList(
                    delegate: SliverChildBuilderDelegate(
                        (_, index) => Padding(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 20, vertical: 5),
                            child: ReportTile(item: items[index])),
                        childCount: items.length)),
            loading: () => const SliverFillRemaining(
                child: Center(child: CircularProgressIndicator())),
            error: (_, __) => const SliverFillRemaining(
                child: Center(child: Text('Unable to load reports.'))))
      ]));
}

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final feed = ref.watch(notificationsProvider);
    final unread = feed.asData?.value.where((item) => item.unread).length ?? 0;
    return ResidentScaffold(
        index: 2,
        child: RefreshIndicator(
            onRefresh: () async => ref.invalidate(notificationsProvider),
            child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 30),
                children: [
                  Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        const Text('Notifications',
                            style: TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.w800,
                                color: TugonColors.navy)),
                        if (unread > 0)
                          TextButton(
                              onPressed: () async {
                                await ref.read(apiProvider).markAllNotificationsRead();
                                ref.invalidate(notificationsProvider);
                              },
                              child: const Text('Mark all read'))
                      ]),
                  const SizedBox(height: 6),
                  Text(
                      feed.isLoading
                          ? 'Loading stored notifications…'
                          : unread > 0
                              ? '$unread unread of ${feed.asData?.value.length ?? 0}'
                              : 'All ${feed.asData?.value.length ?? 0} notifications read',
                      style: const TextStyle(
                          fontSize: 12, color: TugonColors.muted)),
                  const SizedBox(height: 18),
                  feed.when(
                      loading: () => const Padding(
                          padding: EdgeInsets.all(20), child: LinearProgressIndicator()),
                      error: (_, __) => const Card(
                          child: Padding(
                              padding: EdgeInsets.all(16),
                              child: Text(
                                  'Notifications could not be loaded. Pull to retry.'))),
                      data: (items) {
                        if (items.isEmpty) {
                          return const Card(
                              child: Padding(
                                  padding: EdgeInsets.all(18),
                                  child: Text(
                                      'No notifications yet. Updates about your reports appear here.',
                                      style: TextStyle(
                                          color: TugonColors.muted, fontSize: 12))));
                        }
                        return Column(
                            children: items
                                .map((item) => NotificationTile(notification: item))
                                .toList());
                      })
                ])));
  }
}

class NotificationTile extends ConsumerWidget {
  const NotificationTile({super.key, required this.notification});
  final ResidentNotification notification;

  IconData get _icon => switch (notification.type) {
        'report_confirmation' => Icons.check_circle_outline,
        'emergency_alert' => Icons.warning_amber_rounded,
        'announcement' => Icons.campaign_outlined,
        _ => Icons.info_outline,
      };

  Color get _color => notification.type == 'emergency_alert'
      ? TugonColors.emergency
      : TugonColors.blue;

  Color get _tint => notification.type == 'emergency_alert'
      ? const Color(0xFFFFF1F2)
      : const Color(0xFFDBEAFE);

  @override
  Widget build(BuildContext context, WidgetRef ref) => Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
          onTap: notification.unread
              ? () async {
                  await ref.read(apiProvider).markNotificationRead(notification.id);
                  ref.invalidate(notificationsProvider);
                }
              : null,
          contentPadding: const EdgeInsets.all(13),
          tileColor: notification.unread ? const Color(0xFFEFF6FF) : null,
          leading: CircleAvatar(
              backgroundColor: _tint,
              foregroundColor: _color,
              child: Icon(_icon, size: 19)),
          title: Row(children: [
            Expanded(
                child: Text(notification.title,
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700))),
            if (notification.unread)
              Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                      color: TugonColors.blue, shape: BoxShape.circle))
          ]),
          subtitle: Padding(
              padding: const EdgeInsets.only(top: 5),
              child: Text(
                  '${notification.body}\n${notification.type.replaceAll('_', ' ')} · ${relativeTimestamp(notification.createdAt)}',
                  style: const TextStyle(
                      fontSize: 11, height: 1.45, color: TugonColors.muted)))));
}

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(supabaseProvider).auth.currentUser;
    final fullName = user?.userMetadata?['full_name']?.toString() ?? 'Resident';
    return ResidentScaffold(
        index: 3,
        child: ListView(padding: const EdgeInsets.all(20), children: [
          const Text('Profile',
              style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  color: TugonColors.navy)),
          const SizedBox(height: 20),
          Center(
              child: CircleAvatar(
                  radius: 38,
                  backgroundColor: TugonColors.navy,
                  child: Text(fullName.substring(0, 1).toUpperCase(),
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 25,
                          fontWeight: FontWeight.w700)))),
          const SizedBox(height: 12),
          Center(
              child: Text(fullName,
                  style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: TugonColors.navy))),
          Center(
              child: Text(user?.email ?? '',
                  style:
                      const TextStyle(fontSize: 12, color: TugonColors.muted))),
          const SizedBox(height: 30),
          const ProfileCounts(),
          const SizedBox(height: 18),
          OutlinedButton(
              onPressed: () => ref.read(supabaseProvider).auth.signOut(),
              child: const Text('Sign out'))
        ]));
  }
}

/// Summarises the signed-in resident's own stored records.
class ProfileCounts extends ConsumerWidget {
  const ProfileCounts({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reports = ref.watch(incidentsProvider);
    final notifications = ref.watch(notificationsProvider);
    final items = reports.asData?.value ?? <ResidentIncident>[];
    final resolved = items
        .where((item) => item.status == 'resolved' || item.status == 'closed')
        .length;
    final unread =
        notifications.asData?.value.where((item) => item.unread).length ?? 0;
    return Card(
        child: Column(children: [
      ListTile(
          leading: const Icon(Icons.receipt_long_outlined),
          title: const Text('My reports'),
          trailing: Text(reports.isLoading ? '…' : '${items.length}',
              style: const TextStyle(fontWeight: FontWeight.w800))),
      ListTile(
          leading: const Icon(Icons.task_alt_outlined),
          title: const Text('Resolved or closed'),
          trailing: Text(reports.isLoading ? '…' : '$resolved',
              style: const TextStyle(fontWeight: FontWeight.w800))),
      ListTile(
          leading: const Icon(Icons.notifications_none),
          title: const Text('Unread alerts'),
          trailing: Text(notifications.isLoading ? '…' : '$unread',
              style: const TextStyle(fontWeight: FontWeight.w800)))
    ]));
  }
}

class ResidentScaffold extends StatelessWidget {
  const ResidentScaffold({super.key, required this.child, required this.index});
  final Widget child;
  final int index;

  @override
  Widget build(BuildContext context) => Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
          selectedIndex: index,
          onDestinationSelected: (value) =>
              context.go(['/', '/reports', '/notifications', '/profile'][value]),
          destinations: const [
            NavigationDestination(
                icon: Icon(Icons.home_outlined),
                selectedIcon: Icon(Icons.home),
                label: 'Home'),
            NavigationDestination(
                icon: Icon(Icons.receipt_long_outlined),
                selectedIcon: Icon(Icons.receipt_long),
                label: 'Reports'),
            NavigationDestination(
                icon: Icon(Icons.notifications_none),
                selectedIcon: Icon(Icons.notifications),
                label: 'Alerts'),
            NavigationDestination(
                icon: Icon(Icons.person_outline),
                selectedIcon: Icon(Icons.person),
                label: 'Profile')
          ]));
}
