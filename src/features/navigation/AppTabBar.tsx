import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, minTouchTarget, radius, spacing, strings, useAppTheme } from '@/ui';

export interface AppTabBarProps extends BottomTabBarProps {
  /** The centre button opens the add sheet instead of navigating to a route. */
  onAddPress: () => void;
}

const LABELS: Record<string, string> = {
  home: strings.tabs.home,
  records: strings.tabs.records,
  profile: strings.tabs.profile,
  settings: strings.tabs.settings,
};

/**
 * Bottom bar with a raised centre action.
 *
 * Selection is expressed with colour and weight rather than an icon glyph: the project has no
 * vector-icon font, and a missing glyph renders as a tofu box (ADR-014).
 */
export function AppTabBar({ state, navigateToTab, onAddPress }: AppTabBarProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const label = LABELS[route.name] ?? route.name;

        return (
          <View key={route.key} style={styles.slotGroup}>
            {index === 2 ? (
              <Pressable
                testID="tab-add"
                onPress={onAddPress}
                accessibilityRole="button"
                accessibilityLabel={strings.tabs.add}
                accessibilityHint="Add a record"
                style={[styles.addButton, { backgroundColor: colors.primary }]}
              >
                <AppText variant="subtitle" style={{ color: colors.onPrimary }}>
                  +
                </AppText>
              </Pressable>
            ) : null}

            <Pressable
              testID={`tab-${route.name}`}
              onPress={() => {
                if (!focused) navigateToTab(route.key);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              style={styles.tab}
            >
              <AppText
                variant="caption"
                color={focused ? 'primary' : 'muted'}
                style={{ fontWeight: focused ? '700' : '400' }}
              >
                {label}
              </AppText>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.xs,
  },
  slotGroup: { flex: 1, alignItems: 'center', gap: spacing.xs },
  tab: { minHeight: minTouchTarget, minWidth: 56, alignItems: 'center', justifyContent: 'center' },
  addButton: {
    position: 'absolute',
    bottom: spacing.xl,
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
