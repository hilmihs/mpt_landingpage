import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/portal-mpt-x7/",
          "/admin/",
          "/booking/confirm/",
          "/api/",
          "/auth/",
        ],
      },
    ],
  };
}
