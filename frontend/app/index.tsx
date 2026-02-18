import { useAuthStore } from '@/lib/store';
import { Redirect } from 'expo-router';

export default function Index() {
  const { user, initialized } = useAuthStore();
  if (!initialized) return null;
  if (!user) return <Redirect href="/auth/login" />;
  if (!user.playstyle_vector) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}
