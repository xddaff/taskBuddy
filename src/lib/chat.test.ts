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

const owner = student({
  gitlabUserId: 10,
  username: "owner",
  name: "Owner",
  accessLevel: ACCESS_LEVEL.OWNER,
});

describe("canAccessRoom", () => {
  it("lets a student into both rooms", () => {
    expect(canAccessRoom(student(), "students")).toBe(true);
    expect(canAccessRoom(student(), "class")).toBe(true);
  });

  it("lets a maintainer into the class room but not the students room", () => {
    expect(canAccessRoom(maintainer, "class")).toBe(true);
    expect(canAccessRoom(maintainer, "students")).toBe(false);
  });

  it("treats owners as instructors too", () => {
    expect(canAccessRoom(owner, "class")).toBe(true);
    expect(canAccessRoom(owner, "students")).toBe(false);
  });
});

describe("roomsFor", () => {
  it("returns both rooms for a student", () => {
    expect(roomsFor(student()).map((room) => room.key)).toEqual(["students", "class"]);
  });

  it("returns only the class room for a maintainer", () => {
    expect(roomsFor(maintainer).map((room) => room.key)).toEqual(["class"]);
  });

  it("never returns a room the viewer cannot access", () => {
    for (const viewer of [student(), maintainer, owner]) {
      for (const room of roomsFor(viewer)) {
        expect(canAccessRoom(viewer, room.key)).toBe(true);
      }
    }
  });
});

describe("defaultRoomFor", () => {
  it("opens the students room for students and the class room for instructors", () => {
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
