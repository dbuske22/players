import { Tabs } from 'expo-router';
import { ShoppingBagIcon, PlusCircleIcon, LayoutDashboardIcon, UserIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';

export default function TabLayout() {
  const { colorScheme } = useColorScheme();
  const theme = THEME[colorScheme ?? 'light'];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#7C3AED',
        tabBarInactiveTintColor: theme.mutedForeground,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Marketplace',
          tabBarIcon: ({ color, size }) => <ShoppingBagIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="sell"
        options={{
          title: 'Sell',
          tabBarIcon: ({ color, size }) => <PlusCircleIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <LayoutDashboardIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <UserIcon color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
