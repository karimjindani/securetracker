import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import BusinessIcon from '@mui/icons-material/Business';
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
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  ThemeProvider,
  Toolbar,
  Typography,
  createTheme
} from '@mui/material';
import { navigationByRole, type Role } from '@securetracker/shared';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthProvider.js';

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
        <Typography color="text.secondary">Authentication and RBAC baseline for v0.2.0.</Typography>
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

function RestrictedPage({ required, title }: { required: string; title: string }) {
  const { user } = useAuth();
  if (!user || !navigationByRole[user.role].includes(required)) {
    return <Navigate to="/access-denied" replace />;
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h5">{title}</Typography>
      <Alert severity="info">API-backed {title.toLowerCase()} management lands in this v0.2.0 baseline.</Alert>
    </Stack>
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
