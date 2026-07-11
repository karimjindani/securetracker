import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import AppsIcon from '@mui/icons-material/Apps';
import BusinessIcon from '@mui/icons-material/Business';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LogoutIcon from '@mui/icons-material/Logout';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import PeopleIcon from '@mui/icons-material/People';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SecurityIcon from '@mui/icons-material/Security';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  CssBaseline,
  Divider,
  FormControlLabel,
  Grid,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  ThemeProvider,
  Toolbar,
  Typography,
  createTheme
} from '@mui/material';
import {
  applicationCriticalities,
  applicationEnvironments,
  assessmentTypes,
  canManageApplications,
  canManageCalendar,
  canManageScoping,
  engagementStatuses,
  navigationByRole,
  type ApplicationCriticality,
  type ApplicationEnvironment,
  type AssessmentType,
  type EngagementStatus,
  type Role
} from '@securetracker/shared';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthProvider.js';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const opsEnabled = import.meta.env.VITE_OPS_ENABLED === 'true';

interface ApplicationRecord {
  id: string;
  name: string;
  businessOwnerName?: string;
  technicalOwnerName?: string;
  environment: ApplicationEnvironment;
  criticality: ApplicationCriticality;
  internetFacing: boolean;
  status: string;
}

interface CalendarEntry {
  id: string;
  title: string;
  assessmentType: AssessmentType;
  plannedMonth?: string;
  plannedYear: number;
  plannedStartDate?: string;
  plannedEndDate?: string;
  status: string;
  application: ApplicationRecord;
}

interface ScopingRecord {
  id: string;
  meetingDate: string;
  meetingTime?: string;
  participants: string;
  minutes?: string;
  scopeIncluded: string;
  scopeExcluded?: string;
  testingWindowStart?: string;
  testingWindowEnd?: string;
  testAccountsSummary?: string;
  architectureSummary?: string;
  recordStatus: 'DRAFT' | 'FINAL';
  finalizedAt?: string;
}

interface EngagementRecord extends CalendarEntry {
  actualStartDate?: string;
  actualEndDate?: string;
  closureNotes?: string;
  scopingRecords?: ScopingRecord[];
  vendorOrganization?: { id: string; name: string };
}

interface OpsServiceStatus {
  name: string;
  status: 'ok' | 'down' | 'unavailable';
  detail: string;
}

interface OpsHealth {
  opsEnabled: boolean;
  prefix: string;
  services: OpsServiceStatus[];
}

interface OpsContainer {
  name: string;
  service: string;
  state: string;
  status: string;
}

interface OpsRun {
  id: string;
  status: 'running' | 'passed' | 'failed';
  startedAt: string;
  finishedAt?: string;
  exitCode?: number | null;
  logs: string[];
}

const emptyApplicationForm = {
  name: '',
  description: '',
  businessOwnerName: '',
  technicalOwnerName: '',
  environment: 'PRODUCTION' as ApplicationEnvironment,
  url: '',
  criticality: 'HIGH' as ApplicationCriticality,
  technologyStack: '',
  internetFacing: false
};

const emptyCalendarForm = {
  applicationId: '',
  title: '',
  assessmentType: 'WHITEBOX' as AssessmentType,
  plannedMonth: '',
  plannedYear: new Date().getFullYear(),
  plannedStartDate: '',
  plannedEndDate: ''
};

const emptyScopingForm = {
  meetingDate: '',
  meetingTime: '',
  participants: 'Paysys Labs Security, Apprise VAPT Team',
  minutes: '',
  scopeIncluded: '',
  scopeExcluded: '',
  testingWindowStart: '',
  testingWindowEnd: '',
  testAccountsSummary: '',
  architectureSummary: ''
};

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#255f85' },
    secondary: { main: '#6b7f2a' },
    background: { default: '#f6f8fa' }
  },
  shape: { borderRadius: 6 },
  typography: {
    fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 }
  }
});

const navigation = [
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
  { id: 'applications', label: 'Applications', path: '/applications', icon: <AppsIcon /> },
  { id: 'calendar', label: 'VAPT Calendar', path: '/calendar', icon: <CalendarMonthIcon /> },
  { id: 'engagements', label: 'Engagements', path: '/engagements', icon: <TrackChangesIcon /> },
  { id: 'organizations', label: 'Organizations', path: '/organizations', icon: <BusinessIcon /> },
  { id: 'users', label: 'Users', path: '/users', icon: <PeopleIcon /> },
  { id: 'ops', label: 'Ops Console', path: '/ops', icon: <MonitorHeartIcon /> }
];

export function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/access-denied" element={<AccessDenied />} />
            <Route path="/*" element={<ProtectedShell />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

function ProtectedShell() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === 'loading') {
    return <LoadingState />;
  }

  if (auth.status === 'anonymous') {
    return <LoginScreen onLogin={auth.login} />;
  }

  const allowedNavigation = navigation.filter(
    (item) => navigationByRole[auth.user.role].includes(item.id) && (item.id !== 'ops' || opsEnabled)
  );

  return (
    <>
      <AppBar position="static" color="primary" elevation={0}>
        <Toolbar>
          <SecurityIcon sx={{ mr: 1.5 }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            SecureTracker
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip label={auth.user.role.replaceAll('_', ' ')} size="small" color="secondary" />
            <Button color="inherit" startIcon={<LogoutIcon />} onClick={auth.logout}>
              Logout
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '260px 1fr' }, minHeight: 'calc(100vh - 64px)' }}>
        <Paper square variant="outlined" sx={{ borderTop: 0, borderBottom: 0 }}>
          <List>
            {allowedNavigation.map((item) => (
              <ListItemButton
                key={item.id}
                component={Link}
                to={item.path}
                selected={location.pathname === item.path}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
          </List>
          <Divider />
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {auth.user.fullName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {auth.user.organizationName}
            </Typography>
          </Box>
        </Paper>
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard role={auth.user.role} />} />
            <Route path="/applications" element={<GuardedPage required="applications" element={<ApplicationsPage />} />} />
            <Route path="/calendar" element={<GuardedPage required="calendar" element={<CalendarPage />} />} />
            <Route path="/engagements" element={<GuardedPage required="engagements" element={<EngagementsPage />} />} />
            <Route path="/engagements/:id" element={<GuardedPage required="engagements" element={<EngagementDetailPage />} />} />
            <Route path="/organizations" element={<RestrictedPage required="organizations" title="Organizations" />} />
            <Route path="/users" element={<RestrictedPage required="users" title="Users" />} />
            <Route path="/ops" element={<GuardedPage required="ops" element={<OpsPage />} />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Container>
      </Box>
    </>
  );
}

function OpsPage() {
  const { apiFetch } = useAuth();
  const [health, setHealth] = useState<OpsHealth | null>(null);
  const [containers, setContainers] = useState<OpsContainer[]>([]);
  const [run, setRun] = useState<OpsRun | null>(null);
  const [message, setMessage] = useState('');

  const loadOps = async () => {
    const [healthResponse, containersResponse] = await Promise.all([
      apiFetch(`${apiBaseUrl}/ops/health`),
      apiFetch(`${apiBaseUrl}/ops/containers`)
    ]);
    if (healthResponse.ok) setHealth(await healthResponse.json());
    if (containersResponse.ok) setContainers(await containersResponse.json());
  };

  useEffect(() => {
    if (opsEnabled) void loadOps();
  }, []);

  useEffect(() => {
    if (!run || run.status !== 'running') return;
    const timer = window.setInterval(async () => {
      const response = await apiFetch(`${apiBaseUrl}/ops/regression/runs/${run.id}`);
      if (response.ok) setRun(await response.json());
    }, 2500);
    return () => window.clearInterval(timer);
  }, [apiFetch, run]);

  if (!opsEnabled) {
    return <Alert severity="warning">Ops Console is disabled for this frontend environment.</Alert>;
  }

  const startRegression = async () => {
    const response = await apiFetch(`${apiBaseUrl}/ops/regression/run`, { method: 'POST' });
    if (response.ok) {
      setRun(await response.json());
      setMessage('Regression suite started.');
    } else {
      setMessage('Regression suite could not be started.');
    }
  };

  const cleanup = async () => {
    if (!window.confirm('Clean only regression-generated test data?')) return;
    const response = await apiFetch(`${apiBaseUrl}/ops/test-data/cleanup`, { method: 'POST' });
    setMessage(response.ok ? 'Regression test data cleaned.' : 'Regression cleanup failed.');
    await loadOps();
  };

  const reset = async () => {
    if (!window.confirm('Reset SecureTracker to seeded baseline data?')) return;
    const response = await apiFetch(`${apiBaseUrl}/ops/reset`, { method: 'POST' });
    setMessage(response.ok ? 'Seeded baseline restored.' : 'Seeded reset failed.');
    await loadOps();
  };

  return (
    <Stack spacing={3}>
      <PageTitle title="Ops Console" subtitle="Local development health, regression, cleanup, and reset controls." />
      {message && <Alert severity={message.includes('failed') || message.includes('could not') ? 'error' : 'success'}>{message}</Alert>}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
        <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={startRegression}>
          Run Regression Suite
        </Button>
        <Button variant="outlined" startIcon={<CleaningServicesIcon />} onClick={cleanup}>
          Clean Test Data
        </Button>
        <Button color="warning" variant="outlined" startIcon={<RestartAltIcon />} onClick={reset}>
          Reset Seeded Data
        </Button>
      </Stack>
      <Grid container spacing={2}>
        {(health?.services ?? []).map((service) => (
          <Grid key={service.name} size={{ xs: 12, md: 4 }}>
            <RecordCard
              title={service.name}
              chips={[service.status.toUpperCase()]}
              lines={[service.detail, `Regression prefix: ${health?.prefix ?? 'REGRESSION_'}`]}
            />
          </Grid>
        ))}
      </Grid>
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="h6" gutterBottom>
          Containers
        </Typography>
        <Stack spacing={1}>
          {containers.map((container) => (
            <Box key={`${container.service}-${container.name}`} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 2fr' }, gap: 1 }}>
              <Typography variant="body2">{container.service}</Typography>
              <Typography variant="body2" color="text.secondary">{container.state}</Typography>
              <Typography variant="body2" color="text.secondary">{container.status}</Typography>
            </Box>
          ))}
          {containers.length === 0 && <Typography color="text.secondary">No container status returned.</Typography>}
        </Stack>
      </Paper>
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="h6" gutterBottom>
          Regression Run
        </Typography>
        {run ? (
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip label={run.status.toUpperCase()} color={run.status === 'passed' ? 'success' : run.status === 'failed' ? 'error' : 'default'} />
              <Chip label={`Exit: ${run.exitCode ?? 'running'}`} />
              <Chip label={new Date(run.startedAt).toLocaleString()} />
            </Stack>
            <Box component="pre" sx={{ m: 0, p: 2, bgcolor: '#111827', color: '#f9fafb', overflow: 'auto', maxHeight: 360, borderRadius: 1, fontSize: 12 }}>
              {run.logs.join('') || 'Waiting for output...'}
            </Box>
          </Stack>
        ) : (
          <Typography color="text.secondary">No regression run started from this session.</Typography>
        )}
      </Paper>
    </Stack>
  );
}

function Dashboard({ role }: { role: Role }) {
  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5">Security Dashboard</Typography>
        <Typography color="text.secondary">Application inventory, VAPT calendar, and engagement workflow baseline for v0.4.0.</Typography>
      </Box>
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="h6" gutterBottom>
          Active Access Profile
        </Typography>
        <Typography color="text.secondary">
          Navigation is filtered for {role.replaceAll('_', ' ')}. API guards remain the source of truth.
        </Typography>
      </Paper>
    </Stack>
  );
}

function ApplicationsPage() {
  const { user, apiFetch } = useAuth();
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [form, setForm] = useState(emptyApplicationForm);
  const [message, setMessage] = useState('');
  const canManage = Boolean(user && canManageApplications(user.role));

  const loadApplications = async () => {
    const response = await apiFetch(`${apiBaseUrl}/applications`);
    if (response.ok) setApplications(await response.json());
  };

  useEffect(() => {
    void loadApplications();
  }, []);

  const submit = async () => {
    const response = await apiFetch(`${apiBaseUrl}/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    setMessage(response.ok ? 'Application saved.' : 'Application could not be saved.');
    if (response.ok) {
      setForm(emptyApplicationForm);
      await loadApplications();
    }
  };

  return (
    <Stack spacing={3}>
      <PageTitle title="Applications" subtitle="Authoritative inventory for systems included in VAPT planning." />
      {message && <Alert severity={message.includes('could not') ? 'error' : 'success'}>{message}</Alert>}
      {canManage && (
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label="Application name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField select fullWidth label="Environment" value={form.environment} onChange={(event) => setForm({ ...form, environment: event.target.value as ApplicationEnvironment })}>
                {applicationEnvironments.map((value) => (
                  <MenuItem key={value} value={value}>{value}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField select fullWidth label="Criticality" value={form.criticality} onChange={(event) => setForm({ ...form, criticality: event.target.value as ApplicationCriticality })}>
                {applicationCriticalities.map((value) => (
                  <MenuItem key={value} value={value}>{value}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label="Business owner" value={form.businessOwnerName} onChange={(event) => setForm({ ...form, businessOwnerName: event.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label="Technical owner" value={form.technicalOwnerName} onChange={(event) => setForm({ ...form, technicalOwnerName: event.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label="URL" value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label="Technology stack" value={form.technologyStack} onChange={(event) => setForm({ ...form, technologyStack: event.target.value })} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControlLabel control={<Switch checked={form.internetFacing} onChange={(event) => setForm({ ...form, internetFacing: event.target.checked })} />} label="Internet facing" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Button variant="contained" onClick={submit}>Save application</Button>
            </Grid>
          </Grid>
        </Paper>
      )}
      <Grid container spacing={2}>
        {applications.map((application) => (
          <Grid key={application.id} size={{ xs: 12, md: 6 }}>
            <RecordCard
              title={application.name}
              chips={[application.criticality, application.environment, application.internetFacing ? 'INTERNET FACING' : 'INTERNAL']}
              lines={[
                `Business owner: ${application.businessOwnerName ?? 'Not set'}`,
                `Technical owner: ${application.technicalOwnerName ?? 'Not set'}`
              ]}
            />
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}

function CalendarPage() {
  const { user, apiFetch } = useAuth();
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [form, setForm] = useState(emptyCalendarForm);
  const [message, setMessage] = useState('');
  const canManage = Boolean(user && canManageCalendar(user.role));

  const currentYear = useMemo(() => String(form.plannedYear), [form.plannedYear]);

  const loadData = async () => {
    const [applicationsResponse, calendarResponse] = await Promise.all([
      apiFetch(`${apiBaseUrl}/applications`),
      apiFetch(`${apiBaseUrl}/calendar?year=${currentYear}`)
    ]);
    if (applicationsResponse.ok) setApplications(await applicationsResponse.json());
    if (calendarResponse.ok) setEntries(await calendarResponse.json());
  };

  useEffect(() => {
    void loadData();
  }, [currentYear]);

  const submit = async () => {
    const response = await apiFetch(`${apiBaseUrl}/calendar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        plannedYear: Number(form.plannedYear),
        plannedStartDate: form.plannedStartDate || undefined,
        plannedEndDate: form.plannedEndDate || undefined
      })
    });
    setMessage(response.ok ? 'Calendar entry saved.' : 'Calendar entry could not be saved.');
    if (response.ok) {
      setForm({ ...emptyCalendarForm, plannedYear: form.plannedYear });
      await loadData();
    }
  };

  return (
    <Stack spacing={3}>
      <PageTitle title="VAPT Calendar" subtitle="Annual and ad-hoc planned VAPT engagements in PLANNED status." />
      {message && <Alert severity={message.includes('could not') ? 'error' : 'success'}>{message}</Alert>}
      {canManage && (
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField select fullWidth label="Application" value={form.applicationId} onChange={(event) => setForm({ ...form, applicationId: event.target.value })}>
                {applications.map((application) => (
                  <MenuItem key={application.id} value={application.id}>{application.name}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth label="VAPT title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <TextField select fullWidth label="Assessment" value={form.assessmentType} onChange={(event) => setForm({ ...form, assessmentType: event.target.value as AssessmentType })}>
                {assessmentTypes.map((value) => (
                  <MenuItem key={value} value={value}>{value}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <TextField fullWidth label="Year" type="number" value={form.plannedYear} onChange={(event) => setForm({ ...form, plannedYear: Number(event.target.value) })} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth label="Month" value={form.plannedMonth} onChange={(event) => setForm({ ...form, plannedMonth: event.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth label="Start date" type="date" InputLabelProps={{ shrink: true }} value={form.plannedStartDate} onChange={(event) => setForm({ ...form, plannedStartDate: event.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth label="End date" type="date" InputLabelProps={{ shrink: true }} value={form.plannedEndDate} onChange={(event) => setForm({ ...form, plannedEndDate: event.target.value })} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Button variant="contained" onClick={submit} disabled={!form.applicationId}>Save planned VAPT</Button>
            </Grid>
          </Grid>
        </Paper>
      )}
      <Grid container spacing={2}>
        {entries.map((entry) => (
          <Grid key={entry.id} size={{ xs: 12, md: 6 }}>
            <RecordCard
              title={entry.title}
              chips={[entry.status, entry.assessmentType, String(entry.plannedYear)]}
              lines={[
                `Application: ${entry.application.name}`,
                `Window: ${formatDate(entry.plannedStartDate)} to ${formatDate(entry.plannedEndDate)}`,
                `Month: ${entry.plannedMonth ?? 'Not set'}`
              ]}
            />
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}

function EngagementsPage() {
  const { apiFetch } = useAuth();
  const [engagements, setEngagements] = useState<EngagementRecord[]>([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const loadEngagements = async () => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (search.trim()) params.set('search', search.trim());
    const response = await apiFetch(`${apiBaseUrl}/engagements?${params.toString()}`);
    if (response.ok) setEngagements(await response.json());
  };

  useEffect(() => {
    void loadEngagements();
  }, [status]);

  return (
    <Stack spacing={3}>
      <PageTitle title="Engagements" subtitle="Track VAPT engagements from planned initiation through closure and Go-Live." />
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 5 }}>
            <TextField fullWidth label="Search" value={search} onChange={(event) => setSearch(event.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField select fullWidth label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
              <MenuItem value="">All statuses</MenuItem>
              {engagementStatuses.map((value) => (
                <MenuItem key={value} value={value}>{value.replaceAll('_', ' ')}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Button variant="contained" fullWidth sx={{ height: '100%' }} onClick={loadEngagements}>Refresh</Button>
          </Grid>
        </Grid>
      </Paper>
      <Grid container spacing={2}>
        {engagements.map((engagement) => (
          <Grid key={engagement.id} size={{ xs: 12, md: 6 }}>
            <Paper variant="outlined" sx={{ p: 2.5, height: '100%' }}>
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
                  <Typography variant="h6">{engagement.title}</Typography>
                  <Button size="small" component={Link} to={`/engagements/${engagement.id}`}>Open</Button>
                </Stack>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip label={engagement.status.replaceAll('_', ' ')} size="small" />
                  <Chip label={engagement.assessmentType.replaceAll('_', ' ')} size="small" />
                  <Chip label={String(engagement.plannedYear)} size="small" />
                </Stack>
                <Typography color="text.secondary" variant="body2">Application: {engagement.application.name}</Typography>
                <Typography color="text.secondary" variant="body2">Vendor: {engagement.vendorOrganization?.name ?? 'Not assigned'}</Typography>
                <Typography color="text.secondary" variant="body2">Scoping records: {engagement.scopingRecords?.length ?? 0}</Typography>
              </Stack>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}

function EngagementDetailPage() {
  const { id } = useParams();
  const { user, apiFetch } = useAuth();
  const [engagement, setEngagement] = useState<EngagementRecord | null>(null);
  const [form, setForm] = useState(emptyScopingForm);
  const [message, setMessage] = useState('');
  const [transitionRemarks, setTransitionRemarks] = useState('');
  const canScope = Boolean(user && canManageScoping(user.role));

  const loadEngagement = async () => {
    if (!id) return;
    const response = await apiFetch(`${apiBaseUrl}/engagements/${id}`);
    if (response.ok) setEngagement(await response.json());
  };

  useEffect(() => {
    void loadEngagement();
  }, [id]);

  if (!engagement) {
    return <Alert severity="info">Loading engagement...</Alert>;
  }

  const nextStatuses = nextEngagementStatuses(engagement.status as EngagementStatus, user?.role);
  const canTransition = nextStatuses.length > 0;

  const createScopingRecord = async () => {
    const response = await apiFetch(`${apiBaseUrl}/engagements/${engagement.id}/scoping-records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        meetingTime: form.meetingTime || undefined,
        minutes: form.minutes || undefined,
        scopeExcluded: form.scopeExcluded || undefined,
        testingWindowStart: form.testingWindowStart || undefined,
        testingWindowEnd: form.testingWindowEnd || undefined,
        testAccountsSummary: form.testAccountsSummary || undefined,
        architectureSummary: form.architectureSummary || undefined
      })
    });
    setMessage(response.ok ? 'Scoping record saved.' : 'Scoping record could not be saved.');
    if (response.ok) {
      setForm(emptyScopingForm);
      await loadEngagement();
    }
  };

  const finalizeScopingRecord = async (recordId: string) => {
    const response = await apiFetch(`${apiBaseUrl}/scoping-records/${recordId}/finalize`, { method: 'POST' });
    setMessage(response.ok ? 'Scoping record finalized.' : 'Scoping record could not be finalized.');
    if (response.ok) await loadEngagement();
  };

  const transition = async (targetStatus: EngagementStatus) => {
    const response = await apiFetch(`${apiBaseUrl}/engagements/${engagement.id}/transitions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetStatus, remarks: transitionRemarks || undefined })
    });
    setMessage(response.ok ? `Engagement moved to ${targetStatus.replaceAll('_', ' ')}.` : 'Status transition failed.');
    if (response.ok) {
      setTransitionRemarks('');
      await loadEngagement();
    }
  };

  return (
    <Stack spacing={3}>
      <PageTitle title={engagement.title} subtitle={`${engagement.application.name} engagement workflow and scoping record.`} />
      {message && <Alert severity={message.includes('failed') || message.includes('could not') ? 'error' : 'success'}>{message}</Alert>}
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip label={engagement.status.replaceAll('_', ' ')} color={engagement.status === 'CLOSED' ? 'success' : 'default'} />
                <Chip label={engagement.assessmentType.replaceAll('_', ' ')} />
                <Chip label={engagement.vendorOrganization?.name ?? 'Vendor not assigned'} />
              </Stack>
              <Typography color="text.secondary">Window: {formatDate(engagement.plannedStartDate)} to {formatDate(engagement.plannedEndDate)}</Typography>
              <Typography color="text.secondary">First meeting: Paysys and Apprise/vendor required; Bank/NBP optional.</Typography>
              <Typography color="text.secondary">NBP initial scope approval is not required. NBP closure authority is preserved.</Typography>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={1.5}>
              <TextField fullWidth label="Transition remarks" value={transitionRemarks} onChange={(event) => setTransitionRemarks(event.target.value)} />
              {canTransition && nextStatuses.map((target) => (
                <Button key={target} variant="contained" onClick={() => transition(target)}>
                  Move to {target.replaceAll('_', ' ')}
                </Button>
              ))}
              {nextStatuses.length === 0 && <Typography color="text.secondary" variant="body2">No role-available transitions.</Typography>}
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="h6" gutterBottom>Scoping Records</Typography>
        <Stack spacing={2}>
          {(engagement.scopingRecords ?? []).map((record) => (
            <Paper key={record.id} variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip label={record.recordStatus} size="small" />
                  <Chip label={formatDate(record.meetingDate)} size="small" />
                  {record.meetingTime && <Chip label={record.meetingTime} size="small" />}
                </Stack>
                <Typography variant="body2">Participants: {record.participants}</Typography>
                <Typography color="text.secondary" variant="body2">Included: {record.scopeIncluded}</Typography>
                {record.scopeExcluded && <Typography color="text.secondary" variant="body2">Excluded: {record.scopeExcluded}</Typography>}
                {canScope && record.recordStatus === 'DRAFT' && (
                  <Button size="small" variant="outlined" onClick={() => finalizeScopingRecord(record.id)}>Finalize scoping record</Button>
                )}
              </Stack>
            </Paper>
          ))}
          {(engagement.scopingRecords ?? []).length === 0 && <Typography color="text.secondary">No scoping records yet.</Typography>}
        </Stack>
      </Paper>

      {canScope && (
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="h6" gutterBottom>New Scoping Record</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth label="Meeting date" type="date" InputLabelProps={{ shrink: true }} value={form.meetingDate} onChange={(event) => setForm({ ...form, meetingDate: event.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth label="Meeting time" value={form.meetingTime} onChange={(event) => setForm({ ...form, meetingTime: event.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth label="Testing start" type="date" InputLabelProps={{ shrink: true }} value={form.testingWindowStart} onChange={(event) => setForm({ ...form, testingWindowStart: event.target.value })} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth multiline minRows={2} label="Participants" value={form.participants} onChange={(event) => setForm({ ...form, participants: event.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth multiline minRows={3} label="Scope included" value={form.scopeIncluded} onChange={(event) => setForm({ ...form, scopeIncluded: event.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth multiline minRows={3} label="Scope excluded" value={form.scopeExcluded} onChange={(event) => setForm({ ...form, scopeExcluded: event.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth multiline minRows={2} label="Test account summary" value={form.testAccountsSummary} onChange={(event) => setForm({ ...form, testAccountsSummary: event.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth multiline minRows={2} label="Architecture summary" value={form.architectureSummary} onChange={(event) => setForm({ ...form, architectureSummary: event.target.value })} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth multiline minRows={2} label="Minutes" value={form.minutes} onChange={(event) => setForm({ ...form, minutes: event.target.value })} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Button variant="contained" onClick={createScopingRecord} disabled={!form.meetingDate || !form.participants || !form.scopeIncluded}>Save scoping record</Button>
            </Grid>
          </Grid>
        </Paper>
      )}
    </Stack>
  );
}

function nextEngagementStatuses(status: EngagementStatus, role?: Role): EngagementStatus[] {
  if (!role) return [];
  const transitions: Partial<Record<EngagementStatus, EngagementStatus[]>> = {
    PLANNED: ['PAYSYS_APPRISE_INITIATED'],
    PAYSYS_APPRISE_INITIATED: ['APPRISE_ASSESSMENT'],
    NBP_IS_REVIEW_CLOSING_MEETING: ['CLOSED'],
    CLOSED: ['GO_LIVE']
  };
  return (transitions[status] ?? []).filter((target) => {
    if (target === 'CLOSED') return role === 'NBP_SECURITY_ADMIN';
    if (target === 'GO_LIVE') return role === 'PAYSYS_SECURITY_ADMIN';
    if (target === 'APPRISE_ASSESSMENT') return role === 'SYSTEM_ADMIN' || role === 'PAYSYS_SECURITY_ADMIN' || role === 'VENDOR_ADMIN';
    return role === 'SYSTEM_ADMIN' || role === 'PAYSYS_SECURITY_ADMIN';
  });
}

function GuardedPage({ required, element }: { required: string; element: ReactElement }) {
  const { user } = useAuth();
  if (!user || !navigationByRole[user.role].includes(required) || (required === 'ops' && !opsEnabled)) {
    return <Navigate to="/access-denied" replace />;
  }

  return element;
}

function RestrictedPage({ required, title }: { required: string; title: string }) {
  return (
    <GuardedPage
      required={required}
      element={
        <Stack spacing={2}>
          <Typography variant="h5">{title}</Typography>
          <Alert severity="info">API-backed {title.toLowerCase()} management was introduced in v0.2.0.</Alert>
        </Stack>
      }
    />
  );
}

function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <Box>
      <Typography variant="h5">{title}</Typography>
      <Typography color="text.secondary">{subtitle}</Typography>
    </Box>
  );
}

function RecordCard({ title, chips, lines }: { title: string; chips: string[]; lines: string[] }) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5, height: '100%' }}>
      <Stack spacing={1.5}>
        <Typography variant="h6">{title}</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {chips.map((chip) => (
            <Chip key={chip} label={chip.replaceAll('_', ' ')} size="small" />
          ))}
        </Stack>
        {lines.map((line) => (
          <Typography key={line} color="text.secondary" variant="body2">
            {line}
          </Typography>
        ))}
      </Stack>
    </Paper>
  );
}

function AccessDenied() {
  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Alert severity="warning">Access denied for the current role.</Alert>
    </Container>
  );
}

function LoadingState() {
  return (
    <Stack alignItems="center" justifyContent="center" sx={{ minHeight: '100vh' }} spacing={2}>
      <CircularProgress />
      <Typography color="text.secondary">Loading SecureTracker session...</Typography>
    </Stack>
  );
}

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper variant="outlined" sx={{ p: 4 }}>
        <Stack spacing={3}>
          <AdminPanelSettingsIcon color="primary" fontSize="large" />
          <Box>
            <Typography variant="h5">SecureTracker Login</Typography>
            <Typography color="text.secondary">Sign in with Keycloak to access the VAPT tracker.</Typography>
          </Box>
          <Button variant="contained" onClick={onLogin}>
            Login with Keycloak
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}

function formatDate(value?: string) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value));
}
