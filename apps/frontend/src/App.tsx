import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import AppsIcon from '@mui/icons-material/Apps';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import BugReportIcon from '@mui/icons-material/BugReport';
import BusinessIcon from '@mui/icons-material/Business';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import DashboardIcon from '@mui/icons-material/Dashboard';
import DownloadIcon from '@mui/icons-material/Download';
import LogoutIcon from '@mui/icons-material/Logout';
import PeopleIcon from '@mui/icons-material/People';
import SecurityIcon from '@mui/icons-material/Security';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import VisibilityIcon from '@mui/icons-material/Visibility';
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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  LinearProgress,
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
  canAssignFindings,
  canCreateFindings,
  canManageOrganizations,
  canManageUsers,
  canRequestRiskAcceptance,
  canReviewRiskAcceptance,
  canRevalidateFindings,
  canUploadReports,
  canManageApplications,
  canManageCalendar,
  canManageScoping,
  engagementStatuses,
  evidenceTypes,
  findingSeverities,
  findingStatuses,
  navigationByRole,
  organizationTypes,
  reportTypes,
  roles,
  type ApplicationCriticality,
  type ApplicationEnvironment,
  type AssessmentType,
  type EvidenceType,
  type EngagementStatus,
  type FindingSeverity,
  type FindingStatus,
  type OrganizationType,
  type ReportType,
  type RevalidationResult,
  type RiskAcceptanceStatus,
  type Role
} from '@securetracker/shared';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthProvider.js';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();

type RecordStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

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

interface OrganizationRecord {
  id: string;
  name: string;
  organizationType: OrganizationType;
  status: RecordStatus;
}

interface UserRecord {
  id: string;
  organizationId: string;
  keycloakUserId: string;
  fullName: string;
  email: string;
  role: Role;
  status: RecordStatus;
  organization?: OrganizationRecord;
}

interface DashboardSummary {
  metrics: Record<string, number>;
  heatmap: Array<Record<string, number | string>>;
  upcomingEngagements: Array<{
    id: string;
    title: string;
    plannedStartDate?: string;
    plannedMonth?: string;
    plannedYear: number;
    applicationName: string;
    vendorName?: string;
  }>;
  vendorPerformance: Array<{ vendorName: string; reports: number; passed: number; failed: number }>;
}

interface AuditLogRecord {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  createdAt: string;
  user?: { fullName: string; email: string };
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

interface ReportVersionRecord {
  id: string;
  versionNumber: number;
  fileName: string;
  fileMimeType: string;
  fileSizeBytes: string;
  sha256Hash: string;
  isPasswordProtected: boolean;
  uploadedAt: string;
  uploadNotes?: string;
  uploadedBy?: { fullName: string; email: string };
}

interface ReportRecord {
  id: string;
  reportType: ReportType;
  title: string;
  description?: string;
  currentVersion: number;
  immutable: boolean;
  createdAt: string;
  versions: ReportVersionRecord[];
}

interface UserOption {
  id: string;
  fullName: string;
  email: string;
}

interface FindingEvidenceRecord {
  id: string;
  evidenceType: EvidenceType;
  title: string;
  notes?: string;
  fileName?: string;
  fileSizeBytes?: string;
  jiraReference?: string;
  gitCommitReference?: string;
  uploadedAt: string;
  uploadedBy?: { fullName: string; email: string };
}

interface RevalidationRecord {
  id: string;
  result: RevalidationResult;
  revalidationDate: string;
  remarks?: string;
  createdAt: string;
  performedBy?: { fullName: string; email: string };
}

interface FindingRecord {
  id: string;
  findingReference: string;
  title: string;
  description: string;
  impact?: string;
  recommendation?: string;
  severity: FindingSeverity;
  cvssScore?: string | null;
  cwe?: string;
  owaspCategory?: string;
  status: FindingStatus;
  assignedToUserId?: string;
  dueDate?: string;
  assignedTo?: UserOption;
  evidence: FindingEvidenceRecord[];
  revalidations: RevalidationRecord[];
  riskAcceptances?: RiskAcceptanceRecord[];
}

interface RiskAcceptanceRecord {
  id: string;
  riskDescription: string;
  businessJustification: string;
  mitigatingControls?: string;
  expiryDate: string;
  status: RiskAcceptanceStatus;
  requestNotes?: string;
  reviewNotes?: string;
  requestedAt: string;
  requestedBy?: { fullName: string; email: string };
  reviewedBy?: { fullName: string; email: string };
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

const emptyOrganizationForm = {
  id: '',
  name: '',
  organizationType: 'PAYSYS' as OrganizationType,
  status: 'ACTIVE' as RecordStatus
};

const emptyUserForm = {
  id: '',
  organizationId: '',
  keycloakUserId: '',
  fullName: '',
  email: '',
  role: 'PAYSYS_DEVELOPER' as Role,
  status: 'ACTIVE' as RecordStatus
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

const emptyReportForm = {
  reportType: 'DRAFT_REPORT' as ReportType,
  title: '',
  description: '',
  uploadNotes: ''
};

const emptyFindingForm = {
  findingReference: '',
  title: '',
  description: '',
  impact: '',
  recommendation: '',
  severity: 'HIGH' as FindingSeverity,
  cvssScore: '',
  cwe: '',
  owaspCategory: '',
  dueDate: ''
};

const emptyEvidenceForm = {
  findingId: '',
  evidenceType: 'DOCUMENT' as EvidenceType,
  title: '',
  notes: '',
  jiraReference: '',
  gitCommitReference: ''
};

const emptyRevalidationForm = {
  findingId: '',
  result: 'PASSED' as RevalidationResult,
  revalidationDate: new Date().toISOString().slice(0, 10),
  remarks: ''
};

const emptyRiskAcceptanceForm = {
  findingId: '',
  riskDescription: '',
  businessJustification: '',
  mitigatingControls: '',
  expiryDate: '',
  requestNotes: ''
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
  { id: 'audit', label: 'Audit', path: '/audit', icon: <AdminPanelSettingsIcon /> }
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
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/applications" element={<GuardedPage required="applications" element={<ApplicationsPage />} />} />
            <Route path="/calendar" element={<GuardedPage required="calendar" element={<CalendarPage />} />} />
            <Route path="/engagements" element={<GuardedPage required="engagements" element={<EngagementsPage />} />} />
            <Route path="/engagements/:id" element={<GuardedPage required="engagements" element={<EngagementDetailPage />} />} />
            <Route path="/organizations" element={<GuardedPage required="organizations" element={<OrganizationsPage />} />} />
            <Route path="/users" element={<GuardedPage required="users" element={<UsersPage />} />} />
            <Route path="/audit" element={<GuardedPage required="audit" element={<AuditPage />} />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Container>
      </Box>
    </>
  );
}

function Dashboard() {
  const { apiFetch, user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const load = async () => {
      const response = await apiFetch(`${apiBaseUrl}/dashboard/summary`);
      if (response.ok) {
        setSummary(await response.json());
        setMessage('');
      } else {
        setMessage('Dashboard metrics could not be loaded.');
      }
    };
    void load();
  }, []);

  const metrics = summary?.metrics ?? {};
  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5">Security Dashboard</Typography>
        <Typography color="text.secondary">Live governance, findings, risk acceptance, and audit visibility for v0.11.3.</Typography>
      </Box>
      {message && <Alert severity="error">{message}</Alert>}
      {!summary ? (
        <LinearProgress />
      ) : (
        <>
          <Grid container spacing={2}>
            {[
              ['Total engagements', metrics.totalEngagements],
              ['Planned', metrics.plannedEngagements],
              ['In progress', metrics.inProgressEngagements],
              ['Closed/Go-Live', metrics.closedEngagements],
              ['Critical open', metrics.criticalOpenFindings],
              ['High open', metrics.highOpenFindings],
              ['Overdue findings', metrics.overdueFindings],
              ['Accepted risks', metrics.acceptedRisks],
              ['Expiring risks', metrics.expiringRisks],
              ['Revalidation success', `${metrics.revalidationSuccessRate ?? 0}%`]
            ].map(([label, value]) => (
              <Grid key={label} size={{ xs: 6, md: 3 }}>
                <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography variant="h5">{value}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper variant="outlined" sx={{ p: 2.5, height: '100%' }}>
                <Typography variant="h6" gutterBottom>Application Heatmap</Typography>
                <Stack spacing={1}>
                  {summary.heatmap.length === 0 && <Typography color="text.secondary">No open findings yet.</Typography>}
                  {summary.heatmap.map((row) => (
                    <Box key={String(row.applicationName)}>
                      <Typography fontWeight={700}>{String(row.applicationName)}</Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL'].map((severity) => (
                          <Chip key={severity} size="small" label={`${severity}: ${row[severity] ?? 0}`} />
                        ))}
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper variant="outlined" sx={{ p: 2.5, height: '100%' }}>
                <Typography variant="h6" gutterBottom>Upcoming Engagements</Typography>
                <Stack spacing={1}>
                  {summary.upcomingEngagements.length === 0 && <Typography color="text.secondary">No upcoming planned engagements.</Typography>}
                  {summary.upcomingEngagements.map((engagement) => (
                    <RecordCard
                      key={engagement.id}
                      title={engagement.title}
                      chips={[engagement.plannedMonth || 'Scheduled', String(engagement.plannedYear)]}
                      lines={[`Application: ${engagement.applicationName}`, `Vendor: ${engagement.vendorName ?? 'Not assigned'}`]}
                    />
                  ))}
                </Stack>
              </Paper>
            </Grid>
          </Grid>
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="h6" gutterBottom>Vendor Performance</Typography>
            <Grid container spacing={2}>
              {summary.vendorPerformance.length === 0 && <Grid size={{ xs: 12 }}><Typography color="text.secondary">No vendor metrics yet.</Typography></Grid>}
              {summary.vendorPerformance.map((vendor) => (
                <Grid key={vendor.vendorName} size={{ xs: 12, md: 4 }}>
                  <RecordCard
                    title={vendor.vendorName}
                    chips={[`Reports ${vendor.reports}`, `Passed ${vendor.passed}`, `Failed ${vendor.failed}`]}
                    lines={[`Visible to ${user?.role.replaceAll('_', ' ')}`]}
                  />
                </Grid>
              ))}
            </Grid>
          </Paper>
        </>
      )}
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

function OrganizationsPage() {
  const { user, apiFetch } = useAuth();
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [form, setForm] = useState(emptyOrganizationForm);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const canManage = Boolean(user && canManageOrganizations(user.role));

  const loadOrganizations = async () => {
    setLoading(true);
    const response = await apiFetch(`${apiBaseUrl}/organizations`);
    if (response.ok) {
      setOrganizations(await response.json());
      setMessage('');
    } else {
      setMessage('Organizations could not be loaded.');
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadOrganizations();
  }, []);

  const save = async () => {
    const url = form.id ? `${apiBaseUrl}/organizations/${form.id}` : `${apiBaseUrl}/organizations`;
    const response = await apiFetch(url, {
      method: form.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, organizationType: form.organizationType, status: form.status })
    });
    setMessage(response.ok ? 'Organization saved.' : 'Organization could not be saved.');
    if (response.ok) {
      setForm(emptyOrganizationForm);
      await loadOrganizations();
    }
  };

  return (
    <Stack spacing={3}>
      <PageTitle title="Organizations" subtitle="NBP, Paysys, Apprise, and auditor organization records." />
      {message && <Alert severity={message.includes('could not') ? 'error' : 'success'}>{message}</Alert>}
      {canManage && (
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 5 }}>
              <TextField fullWidth label="Organization name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField select fullWidth label="Type" value={form.organizationType} onChange={(event) => setForm({ ...form, organizationType: event.target.value as OrganizationType })}>
                {organizationTypes.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <TextField select fullWidth label="Status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as RecordStatus })}>
                {['ACTIVE', 'INACTIVE', 'ARCHIVED'].map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <Button fullWidth variant="contained" onClick={save} disabled={!form.name}>Save</Button>
            </Grid>
          </Grid>
        </Paper>
      )}
      {loading ? <LinearProgress /> : (
        <Grid container spacing={2}>
          {organizations.length === 0 && <Grid size={{ xs: 12 }}><Alert severity="info">No organizations found.</Alert></Grid>}
          {organizations.map((organization) => (
            <Grid key={organization.id} size={{ xs: 12, md: 6 }}>
              <RecordCard
                title={organization.name}
                chips={[organization.organizationType, organization.status]}
                lines={[canManage ? 'Select edit to update this organization.' : 'Read-only organization record.']}
              />
              {canManage && <Button sx={{ mt: 1 }} size="small" onClick={() => setForm(organization)}>Edit</Button>}
            </Grid>
          ))}
        </Grid>
      )}
    </Stack>
  );
}

function UsersPage() {
  const { user, apiFetch } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [form, setForm] = useState(emptyUserForm);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const canManage = Boolean(user && canManageUsers(user.role));

  const load = async () => {
    setLoading(true);
    const [usersResponse, organizationsResponse] = await Promise.all([
      apiFetch(`${apiBaseUrl}/users`),
      apiFetch(`${apiBaseUrl}/organizations`)
    ]);
    if (usersResponse.ok) setUsers(await usersResponse.json());
    if (organizationsResponse.ok) setOrganizations(await organizationsResponse.json());
    if (!usersResponse.ok || !organizationsResponse.ok) setMessage('Users could not be loaded.');
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    const url = form.id ? `${apiBaseUrl}/users/${form.id}` : `${apiBaseUrl}/users`;
    const response = await apiFetch(url, {
      method: form.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId: form.organizationId,
        keycloakUserId: form.keycloakUserId,
        fullName: form.fullName,
        email: form.email,
        role: form.role,
        status: form.status
      })
    });
    setMessage(response.ok ? 'User saved.' : 'User could not be saved.');
    if (response.ok) {
      setForm(emptyUserForm);
      await load();
    }
  };

  return (
    <Stack spacing={3}>
      <PageTitle title="Users" subtitle="Local user metadata synchronized with Keycloak identities." />
      {message && <Alert severity={message.includes('could not') ? 'error' : 'success'}>{message}</Alert>}
      {canManage && (
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth label="Full name" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth label="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField fullWidth label="Keycloak user id" value={form.keycloakUserId} onChange={(event) => setForm({ ...form, keycloakUserId: event.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField select fullWidth label="Organization" value={form.organizationId} onChange={(event) => setForm({ ...form, organizationId: event.target.value })}>
                {organizations.map((organization) => <MenuItem key={organization.id} value={organization.id}>{organization.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField select fullWidth label="Role" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Role })}>
                {roles.map((role) => <MenuItem key={role} value={role}>{role}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <TextField select fullWidth label="Status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as RecordStatus })}>
                {['ACTIVE', 'INACTIVE', 'ARCHIVED'].map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <Button fullWidth variant="contained" onClick={save} disabled={!form.organizationId || !form.keycloakUserId || !form.fullName || !form.email}>Save</Button>
            </Grid>
          </Grid>
        </Paper>
      )}
      {loading ? <LinearProgress /> : (
        <Grid container spacing={2}>
          {users.length === 0 && <Grid size={{ xs: 12 }}><Alert severity="info">No users found.</Alert></Grid>}
          {users.map((record) => (
            <Grid key={record.id} size={{ xs: 12, md: 6 }}>
              <RecordCard
                title={record.fullName}
                chips={[record.role, record.status]}
                lines={[record.email, `Organization: ${record.organization?.name ?? record.organizationId}`]}
              />
              {canManage && <Button sx={{ mt: 1 }} size="small" onClick={() => setForm(record)}>Edit</Button>}
            </Grid>
          ))}
        </Grid>
      )}
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
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [findings, setFindings] = useState<FindingRecord[]>([]);
  const [assignees, setAssignees] = useState<UserOption[]>([]);
  const [form, setForm] = useState(emptyScopingForm);
  const [reportForm, setReportForm] = useState(emptyReportForm);
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [findingForm, setFindingForm] = useState(emptyFindingForm);
  const [assignForm, setAssignForm] = useState({ findingId: '', assignedToUserId: '', dueDate: '' });
  const [evidenceForm, setEvidenceForm] = useState(emptyEvidenceForm);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [revalidationForm, setRevalidationForm] = useState(emptyRevalidationForm);
  const [riskAcceptanceForm, setRiskAcceptanceForm] = useState(emptyRiskAcceptanceForm);
  const [viewer, setViewer] = useState<{ title: string; url: string; protectedPdf: boolean } | null>(null);
  const [message, setMessage] = useState('');
  const [transitionRemarks, setTransitionRemarks] = useState('');
  const canScope = Boolean(user && canManageScoping(user.role));
  const canUploadReport = Boolean(user && canUploadReports(user.role));
  const canCreateFinding = Boolean(user && canCreateFindings(user.role));
  const canAssignFinding = Boolean(user && canAssignFindings(user.role));
  const canRevalidateFinding = Boolean(user && canRevalidateFindings(user.role));
  const canRequestRisk = Boolean(user && canRequestRiskAcceptance(user.role));
  const canReviewRisk = Boolean(user && canReviewRiskAcceptance(user.role));

  const loadEngagement = async () => {
    if (!id) return;
    const response = await apiFetch(`${apiBaseUrl}/engagements/${id}`);
    if (response.ok) setEngagement(await response.json());
  };

  const loadReports = async () => {
    if (!id) return;
    const response = await apiFetch(`${apiBaseUrl}/engagements/${id}/reports`);
    if (response.ok) setReports(await response.json());
  };

  const loadFindings = async () => {
    if (!id) return;
    const response = await apiFetch(`${apiBaseUrl}/engagements/${id}/findings`);
    if (response.ok) setFindings(await response.json());
  };

  const loadAssignees = async () => {
    if (!canAssignFinding) return;
    const response = await apiFetch(`${apiBaseUrl}/findings/assignees`);
    if (response.ok) setAssignees(await response.json());
  };

  useEffect(() => {
    void loadEngagement();
    void loadReports();
    void loadFindings();
  }, [id]);

  useEffect(() => {
    void loadAssignees();
  }, [canAssignFinding]);

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

  const createFinding = async () => {
    const response = await apiFetch(`${apiBaseUrl}/engagements/${engagement.id}/findings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...findingForm,
        cvssScore: findingForm.cvssScore || undefined,
        impact: findingForm.impact || undefined,
        recommendation: findingForm.recommendation || undefined,
        cwe: findingForm.cwe || undefined,
        owaspCategory: findingForm.owaspCategory || undefined,
        dueDate: findingForm.dueDate || undefined
      })
    });
    setMessage(response.ok ? 'Finding created.' : 'Finding could not be created.');
    if (response.ok) {
      setFindingForm(emptyFindingForm);
      await loadFindings();
      await loadEngagement();
    }
  };

  const assignFinding = async () => {
    if (!assignForm.findingId) return;
    const response = await apiFetch(`${apiBaseUrl}/findings/${assignForm.findingId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assignedToUserId: assignForm.assignedToUserId,
        dueDate: assignForm.dueDate || undefined
      })
    });
    setMessage(response.ok ? 'Finding assigned.' : 'Finding assignment failed.');
    if (response.ok) {
      setAssignForm({ findingId: '', assignedToUserId: '', dueDate: '' });
      await loadFindings();
      await loadEngagement();
    }
  };

  const updateFindingStatus = async (findingId: string, targetStatus: FindingStatus, successMessage: string) => {
    const response = await apiFetch(`${apiBaseUrl}/findings/${findingId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetStatus })
    });
    setMessage(response.ok ? successMessage : 'Finding status update failed.');
    if (response.ok) {
      await loadFindings();
      await loadEngagement();
    }
  };

  const uploadEvidence = async () => {
    if (!evidenceForm.findingId) return;
    const body = new FormData();
    body.append('evidenceType', evidenceForm.evidenceType);
    body.append('title', evidenceForm.title);
    if (evidenceForm.notes) body.append('notes', evidenceForm.notes);
    if (evidenceForm.jiraReference) body.append('jiraReference', evidenceForm.jiraReference);
    if (evidenceForm.gitCommitReference) body.append('gitCommitReference', evidenceForm.gitCommitReference);
    if (evidenceFile) body.append('file', evidenceFile);
    const response = await apiFetch(`${apiBaseUrl}/findings/${evidenceForm.findingId}/evidence`, { method: 'POST', body });
    setMessage(response.ok ? 'Evidence uploaded.' : 'Evidence upload failed.');
    if (response.ok) {
      setEvidenceForm(emptyEvidenceForm);
      setEvidenceFile(null);
      await loadFindings();
    }
  };

  const recordRevalidation = async () => {
    if (!revalidationForm.findingId) return;
    const response = await apiFetch(`${apiBaseUrl}/findings/${revalidationForm.findingId}/revalidations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        result: revalidationForm.result,
        revalidationDate: revalidationForm.revalidationDate || undefined,
        remarks: revalidationForm.remarks || undefined
      })
    });
    setMessage(response.ok ? 'Revalidation recorded.' : 'Revalidation could not be recorded.');
    if (response.ok) {
      setRevalidationForm(emptyRevalidationForm);
      await loadFindings();
      await loadEngagement();
    }
  };

  const requestRiskAcceptance = async () => {
    if (!riskAcceptanceForm.findingId) return;
    const response = await apiFetch(`${apiBaseUrl}/findings/${riskAcceptanceForm.findingId}/risk-acceptances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        riskDescription: riskAcceptanceForm.riskDescription,
        businessJustification: riskAcceptanceForm.businessJustification,
        mitigatingControls: riskAcceptanceForm.mitigatingControls || undefined,
        expiryDate: riskAcceptanceForm.expiryDate,
        requestNotes: riskAcceptanceForm.requestNotes || undefined
      })
    });
    setMessage(response.ok ? 'Risk acceptance requested.' : 'Risk acceptance request failed.');
    if (response.ok) {
      setRiskAcceptanceForm(emptyRiskAcceptanceForm);
      await loadFindings();
    }
  };

  const reviewRiskAcceptance = async (riskAcceptanceId: string, status: 'APPROVED' | 'REJECTED') => {
    const response = await apiFetch(`${apiBaseUrl}/risk-acceptances/${riskAcceptanceId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, reviewNotes: `${status} by NBP Security` })
    });
    setMessage(response.ok ? `Risk acceptance ${status.toLowerCase()}.` : 'Risk acceptance review failed.');
    if (response.ok) await loadFindings();
  };

  const uploadReport = async () => {
    if (!reportFile) {
      setMessage('Select a PDF file before upload.');
      return;
    }
    const body = new FormData();
    body.append('file', reportFile);
    body.append('reportType', reportForm.reportType);
    body.append('title', reportForm.title);
    if (reportForm.description) body.append('description', reportForm.description);
    if (reportForm.uploadNotes) body.append('uploadNotes', reportForm.uploadNotes);
    const response = await apiFetch(`${apiBaseUrl}/engagements/${engagement.id}/reports`, { method: 'POST', body });
    setMessage(response.ok ? 'Report uploaded.' : 'Report upload failed.');
    if (response.ok) {
      setReportForm(emptyReportForm);
      setReportFile(null);
      await loadReports();
      await loadEngagement();
    }
  };

  const openReportVersion = async (report: ReportRecord, version: ReportVersionRecord, mode: 'view' | 'download') => {
    const response = await apiFetch(`${apiBaseUrl}/reports/${report.id}/versions/${version.id}/${mode}`);
    if (!response.ok) {
      setMessage(mode === 'view' ? 'Report viewer could not be opened.' : 'Report download failed.');
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    if (mode === 'download') {
      const link = document.createElement('a');
      link.href = url;
      link.download = version.fileName;
      link.click();
      URL.revokeObjectURL(url);
      return;
    }
    setViewer({ title: `${report.title} v${version.versionNumber}`, url, protectedPdf: version.isPasswordProtected });
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
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <BugReportIcon color="primary" />
            <Typography variant="h6">Findings</Typography>
          </Stack>
          {canCreateFinding && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 2 }}>
                  <TextField fullWidth label="Reference" value={findingForm.findingReference} onChange={(event) => setFindingForm({ ...findingForm, findingReference: event.target.value })} />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField fullWidth label="Title" value={findingForm.title} onChange={(event) => setFindingForm({ ...findingForm, title: event.target.value })} />
                </Grid>
                <Grid size={{ xs: 12, md: 2 }}>
                  <TextField select fullWidth label="Severity" value={findingForm.severity} onChange={(event) => setFindingForm({ ...findingForm, severity: event.target.value as FindingSeverity })}>
                    {findingSeverities.map((severity) => (
                      <MenuItem key={severity} value={severity}>{severity}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 2 }}>
                  <TextField fullWidth label="CVSS" type="number" value={findingForm.cvssScore} onChange={(event) => setFindingForm({ ...findingForm, cvssScore: event.target.value })} />
                </Grid>
                <Grid size={{ xs: 12, md: 2 }}>
                  <TextField fullWidth label="Due date" type="date" InputLabelProps={{ shrink: true }} value={findingForm.dueDate} onChange={(event) => setFindingForm({ ...findingForm, dueDate: event.target.value })} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField fullWidth multiline minRows={3} label="Description" value={findingForm.description} onChange={(event) => setFindingForm({ ...findingForm, description: event.target.value })} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField fullWidth multiline minRows={3} label="Recommendation" value={findingForm.recommendation} onChange={(event) => setFindingForm({ ...findingForm, recommendation: event.target.value })} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField fullWidth label="CWE" value={findingForm.cwe} onChange={(event) => setFindingForm({ ...findingForm, cwe: event.target.value })} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField fullWidth label="OWASP category" value={findingForm.owaspCategory} onChange={(event) => setFindingForm({ ...findingForm, owaspCategory: event.target.value })} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Button variant="contained" onClick={createFinding} disabled={!findingForm.findingReference || !findingForm.title || !findingForm.description}>
                    Create finding
                  </Button>
                </Grid>
              </Grid>
            </Paper>
          )}
          {canAssignFinding && findings.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField select fullWidth label="Finding" value={assignForm.findingId} onChange={(event) => setAssignForm({ ...assignForm, findingId: event.target.value })}>
                    {findings.map((finding) => (
                      <MenuItem key={finding.id} value={finding.id}>{finding.findingReference} - {finding.title}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField select fullWidth label="Assign to developer" value={assignForm.assignedToUserId} onChange={(event) => setAssignForm({ ...assignForm, assignedToUserId: event.target.value })}>
                    {assignees.map((assignee) => (
                      <MenuItem key={assignee.id} value={assignee.id}>{assignee.fullName}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 2 }}>
                  <TextField fullWidth label="Due date" type="date" InputLabelProps={{ shrink: true }} value={assignForm.dueDate} onChange={(event) => setAssignForm({ ...assignForm, dueDate: event.target.value })} />
                </Grid>
                <Grid size={{ xs: 12, md: 2 }}>
                  <Button fullWidth variant="contained" startIcon={<AssignmentIndIcon />} onClick={assignFinding} disabled={!assignForm.findingId || !assignForm.assignedToUserId}>
                    Assign
                  </Button>
                </Grid>
              </Grid>
            </Paper>
          )}
          <Grid container spacing={2}>
            {findings.map((finding) => (
              <Grid key={finding.id} size={{ xs: 12 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{finding.findingReference}: {finding.title}</Typography>
                      <Chip label={finding.severity} color={finding.severity === 'CRITICAL' ? 'error' : finding.severity === 'HIGH' ? 'warning' : 'default'} size="small" />
                      <Chip label={finding.status.replaceAll('_', ' ')} size="small" />
                      <Chip label={finding.assignedTo?.fullName ?? 'Unassigned'} size="small" />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">{finding.description}</Typography>
                    {finding.recommendation && <Typography variant="body2">Recommendation: {finding.recommendation}</Typography>}
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {user?.role === 'PAYSYS_DEVELOPER' && finding.assignedToUserId === user.id && (
                        <>
                          <Button size="small" variant="outlined" onClick={() => updateFindingStatus(finding.id, 'IN_PROGRESS', 'Finding moved to in progress.')}>Start work</Button>
                          <Button size="small" variant="contained" onClick={() => updateFindingStatus(finding.id, 'FIXED_PENDING_REVALIDATION', 'Finding marked fixed pending revalidation.')}>Mark fixed</Button>
                        </>
                      )}
                      {canAssignFinding && finding.status === 'FIXED_PENDING_REVALIDATION' && (
                        <Button size="small" variant="contained" onClick={() => updateFindingStatus(finding.id, 'FIXED_PENDING_REVALIDATION', 'Revalidation requested.')}>Request revalidation</Button>
                      )}
                      {canAssignFinding && finding.status === 'REVALIDATION_PASSED' && (
                        <Button size="small" variant="contained" onClick={() => updateFindingStatus(finding.id, 'CLOSED', 'Finding closed.')}>Close finding</Button>
                      )}
                    </Stack>
                    <Divider />
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <Typography variant="subtitle2">Evidence</Typography>
                        {finding.evidence.map((evidence) => (
                          <Typography key={evidence.id} variant="body2" color="text.secondary">
                            {evidence.title} ({evidence.evidenceType.replaceAll('_', ' ')}) {evidence.fileName ? `- ${evidence.fileName}` : ''}
                          </Typography>
                        ))}
                        {finding.evidence.length === 0 && <Typography variant="body2" color="text.secondary">No evidence yet.</Typography>}
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <Typography variant="subtitle2">Revalidation</Typography>
                        {finding.revalidations.map((revalidation) => (
                          <Typography key={revalidation.id} variant="body2" color="text.secondary">
                            {revalidation.result} on {formatDate(revalidation.revalidationDate)} {revalidation.remarks ? `- ${revalidation.remarks}` : ''}
                          </Typography>
                        ))}
                        {finding.revalidations.length === 0 && <Typography variant="body2" color="text.secondary">No revalidation yet.</Typography>}
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <Typography variant="subtitle2">Risk Acceptance</Typography>
                        {(finding.riskAcceptances ?? []).map((risk) => (
                          <Stack key={risk.id} direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', md: 'center' }} sx={{ py: 0.5 }}>
                            <Chip size="small" label={risk.status} color={risk.status === 'APPROVED' ? 'success' : risk.status === 'REJECTED' ? 'error' : 'default'} />
                            <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                              {risk.riskDescription} - expires {formatDate(risk.expiryDate)}
                            </Typography>
                            {canReviewRisk && risk.status === 'REQUESTED' && (
                              <>
                                <Button size="small" variant="contained" onClick={() => reviewRiskAcceptance(risk.id, 'APPROVED')}>Approve</Button>
                                <Button size="small" variant="outlined" onClick={() => reviewRiskAcceptance(risk.id, 'REJECTED')}>Reject</Button>
                              </>
                            )}
                          </Stack>
                        ))}
                        {(finding.riskAcceptances ?? []).length === 0 && <Typography variant="body2" color="text.secondary">No risk acceptance requested.</Typography>}
                      </Grid>
                    </Grid>
                  </Stack>
                </Paper>
              </Grid>
            ))}
          </Grid>
          {findings.length === 0 && <Typography color="text.secondary">No findings have been created yet.</Typography>}
          {findings.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField select fullWidth label="Evidence finding" value={evidenceForm.findingId} onChange={(event) => setEvidenceForm({ ...evidenceForm, findingId: event.target.value })}>
                    {findings.map((finding) => (
                      <MenuItem key={finding.id} value={finding.id}>{finding.findingReference}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField select fullWidth label="Evidence type" value={evidenceForm.evidenceType} onChange={(event) => setEvidenceForm({ ...evidenceForm, evidenceType: event.target.value as EvidenceType })}>
                    {evidenceTypes.map((type) => (
                      <MenuItem key={type} value={type}>{type.replaceAll('_', ' ')}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField fullWidth label="Evidence title" value={evidenceForm.title} onChange={(event) => setEvidenceForm({ ...evidenceForm, title: event.target.value })} />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <Button component="label" variant="outlined" startIcon={<UploadFileIcon />}>
                    {evidenceFile ? evidenceFile.name : 'Attach file'}
                    <input hidden type="file" onChange={(event) => setEvidenceFile(event.target.files?.[0] ?? null)} />
                  </Button>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField fullWidth label="JIRA reference" value={evidenceForm.jiraReference} onChange={(event) => setEvidenceForm({ ...evidenceForm, jiraReference: event.target.value })} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField fullWidth label="Git commit" value={evidenceForm.gitCommitReference} onChange={(event) => setEvidenceForm({ ...evidenceForm, gitCommitReference: event.target.value })} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField fullWidth multiline minRows={2} label="Evidence notes" value={evidenceForm.notes} onChange={(event) => setEvidenceForm({ ...evidenceForm, notes: event.target.value })} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Button variant="contained" onClick={uploadEvidence} disabled={!evidenceForm.findingId || !evidenceForm.title}>Upload evidence</Button>
                </Grid>
              </Grid>
            </Paper>
          )}
          {canRevalidateFinding && findings.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField select fullWidth label="Revalidation finding" value={revalidationForm.findingId} onChange={(event) => setRevalidationForm({ ...revalidationForm, findingId: event.target.value })}>
                    {findings.map((finding) => (
                      <MenuItem key={finding.id} value={finding.id}>{finding.findingReference}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField select fullWidth label="Result" value={revalidationForm.result} onChange={(event) => setRevalidationForm({ ...revalidationForm, result: event.target.value as RevalidationResult })}>
                    <MenuItem value="PASSED">PASSED</MenuItem>
                    <MenuItem value="FAILED">FAILED</MenuItem>
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField fullWidth label="Date" type="date" InputLabelProps={{ shrink: true }} value={revalidationForm.revalidationDate} onChange={(event) => setRevalidationForm({ ...revalidationForm, revalidationDate: event.target.value })} />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <Button fullWidth variant="contained" onClick={recordRevalidation} disabled={!revalidationForm.findingId}>Record revalidation</Button>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField fullWidth multiline minRows={2} label="Revalidation remarks" value={revalidationForm.remarks} onChange={(event) => setRevalidationForm({ ...revalidationForm, remarks: event.target.value })} />
                </Grid>
              </Grid>
            </Paper>
          )}
          {canRequestRisk && findings.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField select fullWidth label="Risk finding" value={riskAcceptanceForm.findingId} onChange={(event) => setRiskAcceptanceForm({ ...riskAcceptanceForm, findingId: event.target.value })}>
                    {findings.map((finding) => (
                      <MenuItem key={finding.id} value={finding.id}>{finding.findingReference}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField fullWidth label="Expiry date" type="date" InputLabelProps={{ shrink: true }} value={riskAcceptanceForm.expiryDate} onChange={(event) => setRiskAcceptanceForm({ ...riskAcceptanceForm, expiryDate: event.target.value })} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField fullWidth label="Risk description" value={riskAcceptanceForm.riskDescription} onChange={(event) => setRiskAcceptanceForm({ ...riskAcceptanceForm, riskDescription: event.target.value })} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField fullWidth multiline minRows={2} label="Business justification" value={riskAcceptanceForm.businessJustification} onChange={(event) => setRiskAcceptanceForm({ ...riskAcceptanceForm, businessJustification: event.target.value })} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField fullWidth multiline minRows={2} label="Mitigating controls" value={riskAcceptanceForm.mitigatingControls} onChange={(event) => setRiskAcceptanceForm({ ...riskAcceptanceForm, mitigatingControls: event.target.value })} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField fullWidth multiline minRows={2} label="Request notes" value={riskAcceptanceForm.requestNotes} onChange={(event) => setRiskAcceptanceForm({ ...riskAcceptanceForm, requestNotes: event.target.value })} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Button variant="contained" onClick={requestRiskAcceptance} disabled={!riskAcceptanceForm.findingId || !riskAcceptanceForm.riskDescription || !riskAcceptanceForm.businessJustification || !riskAcceptanceForm.expiryDate}>
                    Request risk acceptance
                  </Button>
                </Grid>
              </Grid>
            </Paper>
          )}
        </Stack>
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

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="h6" gutterBottom>Reports</Typography>
        <Stack spacing={2}>
          {canUploadReport && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField select fullWidth label="Report type" value={reportForm.reportType} onChange={(event) => setReportForm({ ...reportForm, reportType: event.target.value as ReportType })}>
                    {reportTypes.map((type) => (
                      <MenuItem key={type} value={type}>{type.replaceAll('_', ' ')}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField fullWidth label="Title" value={reportForm.title} onChange={(event) => setReportForm({ ...reportForm, title: event.target.value })} />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField fullWidth label="Description" value={reportForm.description} onChange={(event) => setReportForm({ ...reportForm, description: event.target.value })} />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField fullWidth label="Upload notes" value={reportForm.uploadNotes} onChange={(event) => setReportForm({ ...reportForm, uploadNotes: event.target.value })} />
                </Grid>
                <Grid size={{ xs: 12, md: 8 }}>
                  <Button component="label" variant="outlined" startIcon={<UploadFileIcon />}>
                    {reportFile ? reportFile.name : 'Select PDF'}
                    <input hidden type="file" accept="application/pdf,.pdf" onChange={(event) => setReportFile(event.target.files?.[0] ?? null)} />
                  </Button>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Button fullWidth variant="contained" onClick={uploadReport} disabled={!reportForm.title || !reportFile}>
                    Upload report
                  </Button>
                </Grid>
              </Grid>
            </Paper>
          )}
          {reports.map((report) => (
            <Paper key={report.id} variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, mr: 1 }}>{report.title}</Typography>
                  <Chip label={report.reportType.replaceAll('_', ' ')} size="small" />
                  <Chip label={`v${report.currentVersion}`} size="small" />
                  {report.immutable && <Chip label="Immutable" color="success" size="small" />}
                </Stack>
                {report.description && <Typography color="text.secondary" variant="body2">{report.description}</Typography>}
                <Stack spacing={1}>
                  {report.versions.map((version) => (
                    <Stack key={version.id} direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'flex-start', md: 'center' }}>
                      <Chip label={`Version ${version.versionNumber}`} size="small" />
                      <Typography variant="body2" sx={{ flexGrow: 1 }}>
                        {version.fileName} - {formatBytes(version.fileSizeBytes)} - SHA-256 {version.sha256Hash.slice(0, 12)}...
                      </Typography>
                      {version.isPasswordProtected && <Chip label="Password protected" color="warning" size="small" />}
                      <IconButton aria-label="View report" onClick={() => openReportVersion(report, version, 'view')}>
                        <VisibilityIcon />
                      </IconButton>
                      <IconButton aria-label="Download report" onClick={() => openReportVersion(report, version, 'download')}>
                        <DownloadIcon />
                      </IconButton>
                    </Stack>
                  ))}
                </Stack>
              </Stack>
            </Paper>
          ))}
          {reports.length === 0 && <Typography color="text.secondary">No reports have been uploaded yet.</Typography>}
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
      <PdfViewerDialog
        open={Boolean(viewer)}
        title={viewer?.title ?? ''}
        url={viewer?.url ?? ''}
        protectedPdf={Boolean(viewer?.protectedPdf)}
        onClose={() => {
          if (viewer?.url) URL.revokeObjectURL(viewer.url);
          setViewer(null);
        }}
      />
    </Stack>
  );
}

function PdfViewerDialog({
  open,
  title,
  url,
  protectedPdf,
  onClose
}: {
  open: boolean;
  title: string;
  url: string;
  protectedPdf: boolean;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState(protectedPdf ? 'Enter the PDF password to view this report.' : 'Loading PDF...');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !url || (protectedPdf && !password)) return;
    let cancelled = false;
    setLoading(true);
    setStatus('Loading PDF...');
    const task = getDocument({ url, password: password || undefined });
    task.promise
      .then(async (pdf) => {
        if (cancelled) return;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.25 });
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (!canvas || !context) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        if (!cancelled) setStatus(`Showing page 1 of ${pdf.numPages}.`);
      })
      .catch(() => {
        if (!cancelled) setStatus('The PDF could not be opened. Check the password if this file is protected.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      task.destroy();
    };
  }, [open, password, protectedPdf, url]);

  useEffect(() => {
    if (open) {
      setPassword('');
      setStatus(protectedPdf ? 'Enter the PDF password to view this report.' : 'Loading PDF...');
    }
  }, [open, protectedPdf]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          {protectedPdf && (
            <TextField
              label="PDF password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              helperText="Password is used only by the browser viewer and is not sent to the backend."
            />
          )}
          {loading && <LinearProgress />}
          <Alert severity={status.includes('could not') ? 'error' : 'info'}>{status}</Alert>
          <Box sx={{ overflow: 'auto', border: '1px solid', borderColor: 'divider', minHeight: 420, bgcolor: '#f8fafc' }}>
            <canvas ref={canvasRef} />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

function AuditPage() {
  const { apiFetch } = useAuth();
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [filters, setFilters] = useState({ action: '', entityType: '', dateFrom: '', dateTo: '' });
  const [message, setMessage] = useState('');

  const load = async () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const response = await apiFetch(`${apiBaseUrl}/audit-logs?${params.toString()}`);
    if (response.ok) {
      setLogs(await response.json());
      setMessage('');
    } else {
      setMessage('Audit logs could not be loaded.');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const exportCsv = async () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const response = await apiFetch(`${apiBaseUrl}/audit-logs/export?${params.toString()}`);
    if (!response.ok) {
      setMessage('Audit export failed.');
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'securetracker-audit.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Stack spacing={3}>
      <PageTitle title="Audit" subtitle="Search and export system activity for governance review." />
      {message && <Alert severity="error">{message}</Alert>}
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField fullWidth label="Action" value={filters.action} onChange={(event) => setFilters({ ...filters, action: event.target.value })} />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField fullWidth label="Entity type" value={filters.entityType} onChange={(event) => setFilters({ ...filters, entityType: event.target.value })} />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <TextField fullWidth label="Date from" type="date" InputLabelProps={{ shrink: true }} value={filters.dateFrom} onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })} />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <TextField fullWidth label="Date to" type="date" InputLabelProps={{ shrink: true }} value={filters.dateTo} onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })} />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={load}>Search</Button>
              <Button variant="outlined" onClick={exportCsv}>CSV</Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>
      <Stack spacing={2}>
        {logs.length === 0 && <Alert severity="info">No audit records match the current filters.</Alert>}
        {logs.map((log) => (
          <Paper key={log.id} variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip label={log.action} size="small" />
                <Chip label={log.entityType} size="small" />
                <Chip label={formatDate(log.createdAt)} size="small" />
              </Stack>
              <Typography variant="body2" color="text.secondary">User: {log.user?.email ?? 'System'}</Typography>
              <Typography variant="body2" color="text.secondary">Entity: {log.entityId ?? 'Not applicable'}</Typography>
            </Stack>
          </Paper>
        ))}
      </Stack>
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
  if (!user || !navigationByRole[user.role].includes(required)) {
    return <Navigate to="/access-denied" replace />;
  }

  return element;
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

function formatBytes(value: string) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return value;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
