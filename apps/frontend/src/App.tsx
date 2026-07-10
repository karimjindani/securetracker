import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import AppsIcon from '@mui/icons-material/Apps';
import BusinessIcon from '@mui/icons-material/Business';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LogoutIcon from '@mui/icons-material/Logout';
import PeopleIcon from '@mui/icons-material/People';
import SecurityIcon from '@mui/icons-material/Security';
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
  navigationByRole,
  type ApplicationCriticality,
  type ApplicationEnvironment,
  type AssessmentType,
  type Role
} from '@securetracker/shared';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthProvider.js';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

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
  { id: 'organizations', label: 'Organizations', path: '/organizations', icon: <BusinessIcon /> },
  { id: 'users', label: 'Users', path: '/users', icon: <PeopleIcon /> }
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

  const allowedNavigation = navigation.filter((item) => navigationByRole[auth.user.role].includes(item.id));

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
            <Route path="/organizations" element={<RestrictedPage required="organizations" title="Organizations" />} />
            <Route path="/users" element={<RestrictedPage required="users" title="Users" />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Container>
      </Box>
    </>
  );
}

function Dashboard({ role }: { role: Role }) {
  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5">Security Dashboard</Typography>
        <Typography color="text.secondary">Application inventory and planned VAPT calendar baseline for v0.3.0.</Typography>
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

function GuardedPage({ required, element }: { required: string; element: ReactElement }) {
  const { user } = useAuth();
  if (!user || !navigationByRole[user.role].includes(required)) {
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
