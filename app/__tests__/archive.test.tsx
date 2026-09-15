import { fireEvent } from "@testing-library/react-native";
import React from "react";

import Archive from "../archive";
import { testRouter } from "./testRouter";
import { renderWithProviders } from "@/components/__tests__/renderWithProviders";
import { t } from "@/i18n";
import { CELLS } from "@/logic/grid";
import { dateKey } from "@/logic/daily";
import { useAdsConsentStore } from "@/store/useAdsConsentStore";
import { usePuzzleStore } from "@/store/usePuzzleStore";
import { usePremiumStore } from "@/store/usePremiumStore";

const todayKey = dateKey(new Date());
const yesterdayKey = dateKey(new Date(Date.now() - 86_400_000));

beforeEach(() => {
  jest.clearAllMocks();
  usePremiumStore.setState({ isPremium: false, isReady: true });
  useAdsConsentStore.setState({
    consent: { canServeAds: true, offerPrivacyOptions: false },
  });
  usePuzzleStore.setState({
    dayKey: null,
    difficulty: "easy",
    givens: new Array(CELLS).fill(0),
    solution: new Array(CELLS).fill(0),
    grid: new Array(CELLS).fill(0),
    marks: {},
    hintsUsed: 0,
    lastHint: null,
    startedAt: null,
    solved: {},
  });
});

describe("the archive", () => {
  it("marks today", async () => {
    const { getByText } = await renderWithProviders(<Archive />);
    expect(getByText(t("todayLabel"))).toBeTruthy();
  });

  it("lets a free player open today", async () => {
    const { getByLabelText } = await renderWithProviders(<Archive />);
    await fireEvent.press(getByLabelText(t("playDay", { date: todayKey })));
    expect(usePuzzleStore.getState().dayKey).toBe(todayKey);
    expect(testRouter.back).toHaveBeenCalled();
  });

  it("sends a free player tapping a past day to the paywall, loading nothing", async () => {
    const { getByLabelText } = await renderWithProviders(<Archive />);
    await fireEvent.press(
      getByLabelText(t("dayLocked", { date: yesterdayKey })),
    );
    expect(testRouter.push).toHaveBeenCalledWith("/paywall");
    expect(usePuzzleStore.getState().dayKey).toBeNull();
  });

  it("opens a past day for a paying player", async () => {
    usePremiumStore.setState({ isPremium: true });
    const { getByLabelText } = await renderWithProviders(<Archive />);
    await fireEvent.press(getByLabelText(t("playDay", { date: yesterdayKey })));
    expect(usePuzzleStore.getState().dayKey).toBe(yesterdayKey);
  });

  it("shows a solved day with its time", async () => {
    usePuzzleStore.setState({
      solved: { [todayKey]: { difficulty: "easy", ms: 125_000, hintsUsed: 1 } },
    });
    const { getByLabelText } = await renderWithProviders(<Archive />);
    expect(
      getByLabelText(t("daySolved", { date: todayKey, time: "2:05" })),
    ).toBeTruthy();
  });
});
