/**
 * Remembers that the full view-as banner was shown for this persona (UI state only, no authority;
 * TASK-S). Lives outside the client component so the server banner can read the real name: a
 * constant exported from a 'use client' module is a client reference on the server.
 */
export const VIEW_AS_SEEN_COOKIE = 'evolai_view_as_seen';
