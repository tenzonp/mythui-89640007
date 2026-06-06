import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/auth/google-client-id")({
  server: {
    handlers: {
      GET: async () => {
        const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;

        if (!clientId) {
          return Response.json(
            { error: "Google sign-in is not configured" },
            { status: 503 },
          );
        }

        return Response.json(
          { clientId },
          {
            headers: {
              "Cache-Control": "public, max-age=300",
            },
          },
        );
      },
    },
  },
});