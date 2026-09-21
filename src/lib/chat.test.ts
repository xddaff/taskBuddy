import { describe, expect, it } from "vitest";
import { ACCESS_LEVEL, type Student } from "@/lib/types";
import { CHAT_ROOMS, canAccessRoom, defaultRoomFor, isChatRoomKey, roomsFor } from "@/lib/chat";

function student(overrides: Partial<Student> = {}): Student {
  return {
    gitlabUserId: 1,
    username: "ana",
    name: "Ana Diaz",
    avatarUrl: null,
    accessLevel: ACCESS_LEVEL.DEVELOPER,
    skills: [],
    ...overrides,
  };
}

const maintainer = student({
  gitlabUserId: 9,
  username: "prof",
  name: "Prof Vega",
  accessLevel: ACCESS_LEVEL.MAINTAINER,
});

describe("rooms", () => {
  it("exposes Class and Teacher rooms", () => {
    expect(CHAT_ROOMS.map((room) => room.label)).toEqual(["Class", "Teacher"]);
    expect(CHAT_ROOMS.map((room) => room.key)).toEqual(["students", "class"]);
  });

  it("lets students and instructors into both rooms", () => {
    expect(canAccessRoom(student(), "students")).toBe(true);
    expect(canAccessRoom(student(), "class")).toBe(true);
    expect(canAccessRoom(maintainer, "students")).toBe(true);
    expect(canAccessRoom(maintainer, "class")).toBe(true);
  });

  it("returns both rooms for every signed-in member", () => {
    expect(roomsFor(student()).map((room) => room.label)).toEqual(["Class", "Teacher"]);
    expect(roomsFor(maintainer).map((room) => room.label)).toEqual(["Class", "Teacher"]);
  });

  it("opens Class for students and Teacher for instructors by default", () => {
    expect(defaultRoomFor(student())).toBe("students");
    expect(defaultRoomFor(maintainer)).toBe("class");
  });
});

describe("isChatRoomKey", () => {
  it("accepts only the known room keys", () => {
    expect(CHAT_ROOMS.every((room) => isChatRoomKey(room.key))).toBe(true);
    expect(isChatRoomKey("staff")).toBe(false);
    expect(isChatRoomKey("")).toBe(false);
    expect(isChatRoomKey(undefined)).toBe(false);
    expect(isChatRoomKey(null)).toBe(false);
    expect(isChatRoomKey(42)).toBe(false);
  });
});
