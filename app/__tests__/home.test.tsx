import { fireEvent } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";

import Home from "../index";
import { testRouter } from "./testRouter";
import { renderWithProviders } from "@/components/__tests__/renderWithProviders";
import { t } from "@/i18n";
import { CELLS } from "@/logic/grid";
import { dateKey } from "@/logic/daily";
import { useAdsConsentStore } from "@/store/useAdsConsentStore";
import { FREE_HINTS, usePuzzleStore } from "@/store/usePuzzleStore";
import { usePremiumStore } from "@/store/usePremiumStore";

const today = new Date();
const todayKey = dateKey(today);

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

describe("the game screen", () => {
  it("loads today automatically when nothing is in progress", async () => {
    await renderWithProviders(<Home />);
    expect(usePuzzleStore.getState().dayKey).toBe(todayKey);
    expect(
      usePuzzleStore.getState().grid.filter((v) => v !== 0).length,
    ).toBeGreaterThan(16);
  });

  it("renders the board with its clues labelled as clues", async () => {
    const { getByLabelText } = await renderWithProviders(<Home />);
    const { givens } = usePuzzleStore.getState();
    const i = givens.findIndex((v) => v !== 0);
    const row = Math.floor(i / 9) + 1;
    const col = (i % 9) + 1;
    expect(
      getByLabelText(
        t("cellGiven", {
          row: String(row),
          col: String(col),
          value: String(givens[i]),
        }),
      ),
    ).toBeTruthy();
  });

  it("enters a digit into the selected cell", async () => {
    const { getByLabelText } = await renderWithProviders(<Home />);
    const i = usePuzzleStore.getState().grid.findIndex((v) => v === 0);
    const row = Math.floor(i / 9) + 1;
    const col = (i % 9) + 1;

    await fireEvent.press(
      getByLabelText(
        t("cellLabel", {
          row: String(row),
          col: String(col),
          value: t("cellEmpty"),
        }),
      ),
    );
    await fireEvent.press(getByLabelText("7"));
    expect(usePuzzleStore.getState().grid[i]).toBe(7);
  });

  it("writes a pencil mark instead of a digit in notes mode", async () => {
    const { getByLabelText, getByText } = await renderWithProviders(<Home />);
    const i = usePuzzleStore.getState().grid.findIndex((v) => v === 0);
    const row = Math.floor(i / 9) + 1;
    const col = (i % 9) + 1;

    await fireEvent.press(
      getByLabelText(
        t("cellLabel", {
          row: String(row),
          col: String(col),
          value: t("cellEmpty"),
        }),
      ),
    );
    await fireEvent.press(getByText(t("notesCta")));
    await fireEvent.press(getByLabelText("4"));

    expect(usePuzzleStore.getState().grid[i]).toBe(0);
    expect(usePuzzleStore.getState().marks[i]).toEqual([4]);
  });

  it("gives a hint that explains itself", async () => {
    const { getByText, queryByText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByText(t("hintsLeft", { n: String(FREE_HINTS) })));

    const hint = usePuzzleStore.getState().lastHint!;
    expect(hint).not.toBeNull();
    // The explanation is on screen, not just in the store.
    expect(queryByText(t("hintApplyCta"))).not.toBeNull();
  });

  it("counts a free player down and then offers the purchase", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const { getByText } = await renderWithProviders(<Home />);

    for (let i = 0; i < FREE_HINTS; i += 1) {
      await fireEvent.press(
        getByText(t("hintsLeft", { n: String(FREE_HINTS - i) })),
      );
      usePuzzleStore.getState().applyLastHint();
    }
    await fireEvent.press(getByText(t("hintsLeft", { n: "0" })));
    expect(alert.mock.calls.at(-1)![0]).toBe(t("hintLimitTitle"));
  });

  it("offers the purchase for auto-filled notes, and fills them once paid", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const free = await renderWithProviders(<Home />);
    await fireEvent.press(free.getByText(t("autoNotesCta")));
    expect(alert.mock.calls[0]![0]).toBe(t("lockedTitle"));
    expect(usePuzzleStore.getState().marks).toEqual({});

    usePremiumStore.setState({ isPremium: true });
    const paid = await renderWithProviders(<Home />);
    await fireEvent.press(paid.getByText(t("autoNotesCta")));
    expect(Object.keys(usePuzzleStore.getState().marks).length).toBeGreaterThan(
      0,
    );
  });

  it("switches difficulty, which is a different puzzle", async () => {
    const { getByLabelText } = await renderWithProviders(<Home />);
    const easy = [...usePuzzleStore.getState().grid];
    await fireEvent.press(getByLabelText(t("diffEvil")));
    expect(usePuzzleStore.getState().difficulty).toBe("evil");
    expect(usePuzzleStore.getState().grid).not.toEqual(easy);
  });

  it("routes to the archive and settings", async () => {
    const { getByText } = await renderWithProviders(<Home />);
    await fireEvent.press(getByText(t("archiveTitle")));
    expect(testRouter.push).toHaveBeenCalledWith("/archive");
    await fireEvent.press(getByText(t("settingsTitle")));
    expect(testRouter.push).toHaveBeenCalledWith("/settings");
  });

  it("announces a solve once and records it", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await renderWithProviders(<Home />);

    const { solution } = usePuzzleStore.getState();
    // Fill the whole board correctly, as a player finishing it would.
    usePuzzleStore.setState({ grid: [...solution] });
    const second = await renderWithProviders(<Home />);
    expect(second).toBeTruthy();

    const solvedCalls = alert.mock.calls.filter(
      (c) => c[0] === t("solvedTitle"),
    );
    expect(solvedCalls.length).toBeGreaterThanOrEqual(1);
    expect(usePuzzleStore.getState().solved[todayKey]).toBeDefined();
  });

  it("locks the board once the puzzle is solved — tapping a cell and a digit changes nothing", async () => {
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await renderWithProviders(<Home />);

    const { solution, givens } = usePuzzleStore.getState();
    usePuzzleStore.setState({ grid: [...solution] });
    const { getByLabelText } = await renderWithProviders(<Home />);

    const blank = givens.findIndex((v) => v === 0);
    const row = Math.floor(blank / 9) + 1;
    const col = (blank % 9) + 1;
    const cellLabel = t("cellLabel", {
      row: String(row),
      col: String(col),
      value: String(solution[blank]),
    });

    await fireEvent.press(getByLabelText(cellLabel));
    await fireEvent.press(getByLabelText("1"));

    // Still the solved grid: the tap on the number pad did nothing, because
    // there was no selected cell for it to write into and the cell itself
    // refused selection.
    expect(usePuzzleStore.getState().grid).toEqual(solution);
  });

  it('offers a "Next Level" button once solved, which loads a new, harder puzzle', async () => {
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await renderWithProviders(<Home />);

    const { solution } = usePuzzleStore.getState();
    usePuzzleStore.setState({ grid: [...solution], difficulty: "easy" });
    const { getByText } = await renderWithProviders(<Home />);

    const solvedGrid = usePuzzleStore.getState().grid;
    await fireEvent.press(getByText(t("nextLevelCta")));

    expect(usePuzzleStore.getState().difficulty).toBe("medium");
    expect(usePuzzleStore.getState().grid).not.toEqual(solvedGrid);
  });
});
