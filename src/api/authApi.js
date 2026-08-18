import client from "./client";

export const authApi = {
  signup: (payload) => client.post("/auth/signup", payload),
  // payload: { name, email, password }

  login: (payload) => client.post("/auth/login", payload),
  // payload: { email, password } -> { token, user }

  googleLogin: (idToken) => client.post("/auth/google", { idToken }),

  me: () => client.get("/auth/me"),
};

export const meetingApi = {
  create: () => client.post("/meetings"),
  // -> { meetingId, joinLink }

  getByCode: (meetingCode) => client.get(`/meetings/${meetingCode}`),

  joinAsGuest: (meetingCode, guestName) =>
    client.post(`/meetings/${meetingCode}/join`, { guestName }),

  myMeetings: () => client.get("/meetings/mine"),
};
