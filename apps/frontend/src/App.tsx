import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import SecurityIcon from '@mui/icons-material/Security';
import TimelineIcon from '@mui/icons-material/Timeline';
import {
  AppBar,
  Box,
  Chip,
  Container,
  CssBaseline,
  Grid,
  Paper,
  Stack,
  ThemeProvider,
  Toolbar,
  Typography,
  createTheme
} from '@mui/material';
import { engagementStatuses } from '@securetracker/shared';

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
    h4: { fontWeight: 700 },
    h6: { fontWeight: 700 }
  }
});

const cards = [
  { label: 'Lifecycle', value: `${engagementStatuses.length} statuses`, icon: <TimelineIcon /> },
  { label: 'Closure Rule', value: 'NBP only', icon: <FactCheckIcon /> },
  { label: 'Reports', value: 'Encrypted PDFs', icon: <SecurityIcon /> },
  { label: 'Audit', value: 'Append-only', icon: <AssignmentTurnedInIcon /> }
];

export function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="static" color="primary" elevation={0}>
        <Toolbar>
          <SecurityIcon sx={{ mr: 1.5 }} />
          <Typography variant="h6">SecureTracker</Typography>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h4" gutterBottom>
              VAPT Tracker Portal
            </Typography>
            <Typography color="text.secondary">
              v0.1.0 foundation for the NBP, Paysys, and Apprise VAPT workflow.
            </Typography>
          </Box>
          <Grid container spacing={2}>
            {cards.map((card) => (
              <Grid key={card.label} size={{ xs: 12, sm: 6, md: 3 }}>
                <Paper sx={{ p: 2.5, minHeight: 132 }} variant="outlined">
                  <Stack spacing={1.5}>
                    <Box color="primary.main">{card.icon}</Box>
                    <Typography variant="h6">{card.label}</Typography>
                    <Typography color="text.secondary">{card.value}</Typography>
                  </Stack>
                </Paper>
              </Grid>
            ))}
          </Grid>
          <Paper sx={{ p: 2.5 }} variant="outlined">
            <Typography variant="h6" gutterBottom>
              Engagement Lifecycle
            </Typography>
            <Stack direction="row" useFlexGap flexWrap="wrap" gap={1}>
              {engagementStatuses.filter((status) => status !== 'CANCELLED').map((status) => (
                <Chip key={status} label={status.replaceAll('_', ' ')} size="small" />
              ))}
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </ThemeProvider>
  );
}
