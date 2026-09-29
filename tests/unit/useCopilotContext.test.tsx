// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useCopilotContext } from "../../src/hooks/useCopilotContext.ts";
import { useWindowManager } from "../../src/stores/useWindowManager.ts";

describe("useCopilotContext", () => {
  beforeEach(() => {
    useWindowManager.setState({ pendingCopilotHackathon: null });
  });

  it("keeps student team skills editable as typed state", () => {
    const { result } = renderHook(() => useCopilotContext());

    act(() => result.current.toggleSkill("Design"));
    expect(result.current.team.skills).toContain("Design");

    act(() => result.current.toggleSkill("Design"));
    expect(result.current.team.skills).not.toContain("Design");
  });
});
