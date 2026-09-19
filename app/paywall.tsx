import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Text } from "@/components/ui";
import { t } from "@/i18n";
import { PRIVACY_POLICY_URL, TERMS_URL } from "@/monetization/config";
import { usePremiumStore } from "@/store/usePremiumStore";
import { useTheme } from "@/theme";
import { useTabletColumn } from "../src/theme/useTabletColumn";

/**
 * The one purchase this app sells: a lifetime non-consumable that removes the ads and unlocks
 * everything. There is deliberately no plan picker — a second option would be a subscription,
 * and the portfolio does not sell those.
 */
const BENEFIT_KEYS = [
  { title: "feat1Title", desc: "feat1Desc" },
  { title: "feat2Title", desc: "feat2Desc" },
  { title: "feat3Title", desc: "feat3Desc" },
  { title: "feat4Title", desc: "feat4Desc" },
] as const;

export default function Paywall() {
  /**
   * Only the claims this app can actually make.
   *
   * Four slots is what this template offers, not a quota to fill. An app whose
   * purchase removes the ads and nothing else has one honest thing to say about
   * it, and padding to four is how "Everything unlocked -- every level, every
   * mode and the full archive" ends up on a paywall for an app with no levels,
   * no modes and no archive.
   *
   * A benefit whose title is blank is dropped, so cutting a claim is a one-line
   * edit in `i18n` rather than a component change. Computed per render, not at
   * module load, so it follows the active locale.
   */
  const benefits = BENEFIT_KEYS.filter((b) => t(b.title).trim().length > 0);
  const router = useRouter();
  const tabletColumn = useTabletColumn(640);
  const insets = useSafeAreaInsets();
  const { colors, spacing, radius } = useTheme();

  const lifetime = usePremiumStore((s) => s.lifetime);
  const offeringsResolved = usePremiumStore((s) => s.offeringsResolved);
  const isPremium = usePremiumStore((s) => s.isPremium);
  const isPurchasing = usePremiumStore((s) => s.isPurchasing);
  const error = usePremiumStore((s) => s.error);
  const purchase = usePremiumStore((s) => s.purchase);
  const restore = usePremiumStore((s) => s.restore);
  // A restore that finds nothing must SAY so.
  // `restore()` returned 'none' and the screen rendered nothing at all, so
  // the button read as broken -- and App Review taps Restore on every
  // submission. The string already existed in all fourteen locales; it was
  // simply never shown on this paywall shape.
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null);
  const refreshOfferings = usePremiumStore((s) => s.refreshOfferings);

  useEffect(() => {
    void refreshOfferings();
  }, [refreshOfferings]);

  // A user who already owns it must never be left staring at a buy button.
  useEffect(() => {
    if (isPremium) router.back();
  }, [isPremium, router]);

  const price = lifetime?.product.priceString;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top,
      }}
    >
      <View style={{ alignItems: "flex-end", padding: spacing.base }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("close")}
          hitSlop={12}
          onPress={() => router.back()}
          style={{
            minWidth: 44,
            minHeight: 44,
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <Text variant="body" tone="muted">
            {t("close")}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: spacing.xl,
          paddingBottom: spacing["3xl"],
          ...tabletColumn,
          flexGrow: 1,
          justifyContent: "center",
        }}
      >
        {/* An article opener, not a numbered feature card.

            29 of 44 apps in this portfolio shipped one paywall file byte for
            byte, and Apple rejected under 4.3(a) naming "multiple similar apps
            using a repackaged app template". The numbered-list shape --
            eyebrow, display title, ticked rows -- was itself part of what
            measured identical across the template.

            So this reads like a short piece of writing instead: a masthead
            headline, a pull-quote carrying the no-subscription promise as the
            page's visual anchor, and the benefits woven into prose rather than
            rows. Same claims, a structurally different page. */}
        <Text variant="display" style={{ letterSpacing: -1 }}>
          {t("paywallTitle")}
        </Text>

        <View style={{ flexDirection: "row", marginTop: spacing["2xl"] }}>
          <View
            style={{
              width: 3,
              borderRadius: radius.xs,
              backgroundColor: colors.accent,
              marginRight: spacing.base,
            }}
          />
          <View style={{ flex: 1 }}>
            {/* Decorative -- the quoted sentence right below is the thing a
                screen reader should say, not this glyph on its own. */}
            <Text
              accessible={false}
              importantForAccessibility="no"
              variant="display"
              tone="accent"
              style={{ lineHeight: 32, opacity: 0.5 }}
            >
              “
            </Text>
            <Text
              variant="title"
              style={{ fontStyle: "italic", marginTop: -spacing.md }}
            >
              {t("antiSubHeadline")}
            </Text>
            <Text
              variant="micro"
              tone="accent"
              style={{
                marginTop: spacing.sm,
                textTransform: "uppercase",
                letterSpacing: 1.2,
              }}
            >
              {t("antiSubTitle")}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: spacing["2xl"] }}>
          {benefits.map((benefit, index) => (
            <View key={benefit.title}>
              {index > 0 ? (
                <View
                  style={{
                    height: StyleSheet.hairlineWidth,
                    backgroundColor: colors.border,
                    marginVertical: spacing.lg,
                  }}
                />
              ) : null}
              <Text variant="body" style={{ lineHeight: 26 }}>
                <Text variant="bodyStrong">{t(benefit.title)}</Text>
                {". "}
                <Text tone="muted">{t(benefit.desc)}</Text>
              </Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: spacing["2xl"] }}>
          {lifetime ? (
            <Button
              label={
                price
                  ? t("lifetimeAccess", { price })
                  : t("lifetimeAccessPlain")
              }
              size="lg"
              fullWidth
              loading={isPurchasing}
              onPress={() => void purchase(lifetime)}
            />
          ) : offeringsResolved ? (
            // Resolved, with no package: the store is genuinely unreachable or carries no
            // product yet. Say that, and keep Restore reachable below — a user who already
            // paid must still be able to get their purchase back.
            <View style={{ padding: spacing.xl, alignItems: "center" }}>
              <Text variant="caption" tone="muted" align="center">
                {t("storeUnavailable")}
              </Text>
            </View>
          ) : (
            <View style={{ padding: spacing.xl, alignItems: "center" }}>
              <ActivityIndicator color={colors.textMuted} />
              <Text
                variant="caption"
                tone="muted"
                style={{ marginTop: spacing.md }}
              >
                {t("loadingPrice")}
              </Text>
            </View>
          )}
          <Text
            variant="caption"
            tone="muted"
            align="center"
            style={{ marginTop: spacing.md }}
          >
            {t("oneTimePayment")}
          </Text>
        </View>

        {error ? (
          <Text
            variant="caption"
            tone="danger"
            align="center"
            style={{ marginTop: spacing.base }}
          >
            {error}
          </Text>
        ) : null}

        {restoreNotice ? (
          <Text
            accessibilityRole="alert"
            variant="caption"
            tone="muted"
            align="center"
            style={{ marginTop: spacing.base }}
          >
            {restoreNotice}
          </Text>
        ) : null}

        <Button
          label={t("restorePurchases")}
          variant="ghost"
          fullWidth
          onPress={() => {
            setRestoreNotice(null);
            void restore().then((outcome) => {
              if (outcome === "none") setRestoreNotice(t("noPriorPurchases"));
            });
          }}
          style={{ marginTop: spacing.lg }}
        />

        <Text
          variant="micro"
          tone="faint"
          align="center"
          style={{ marginTop: spacing.xl }}
        >
          {t("adsDisclosure")}
        </Text>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            gap: spacing.lg,
            marginTop: spacing.md,
          }}
        >
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={t("termsOfUse")}
            hitSlop={12}
            onPress={() => void Linking.openURL(TERMS_URL)}
          >
            <Text variant="micro" tone="faint">
              {t("termsOfUse")}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={t("privacyPolicy")}
            hitSlop={12}
            onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
          >
            <Text variant="micro" tone="faint">
              {t("privacyPolicy")}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
