import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Img,
  Section,
  Hr,
} from "@react-email/components";

interface QuarterlyNotificationProps {
  brandName: string;
  brandLogoUrl?: string | null;
  quarterLabel: string; // e.g. "Q2 2026"
  totalRevenueCents: number;
  totalVolume: number;
  highlights: Array<{ url: string | null; caption: string }>;
  reportUrl: string; // absolute URL to the report
  unsubscribeUrl: string;
}

function formatRevenue(cents: number): string {
  return (cents / 100).toLocaleString("nl-NL", {
    style: "currency",
    currency: "EUR",
  });
}

export function QuarterlyNotification({
  brandName,
  brandLogoUrl,
  quarterLabel,
  totalRevenueCents,
  totalVolume,
  highlights,
  reportUrl,
  unsubscribeUrl,
}: QuarterlyNotificationProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: "sans-serif", backgroundColor: "#f9f9f9" }}>
        <Container
          style={{
            maxWidth: "600px",
            margin: "0 auto",
            backgroundColor: "#fff",
            padding: "32px",
          }}
        >
          {/* Header: logos */}
          <Section
            style={{ display: "flex", justifyContent: "space-between" }}
          >
            <Text style={{ fontWeight: "bold", fontSize: "18px" }}>
              SPIRITED UNION
            </Text>
            {brandLogoUrl && (
              <Img src={brandLogoUrl} alt={brandName} height={40} />
            )}
          </Section>
          <Hr />
          {/* Quarter + headline */}
          <Heading as="h1" style={{ fontSize: "24px" }}>
            Your {quarterLabel} Report is Ready
          </Heading>
          <Text>Dear {brandName} team,</Text>
          <Text>
            Your quarterly sales report for {quarterLabel} is now available.
          </Text>
          {/* Metrics */}
          <Section>
            <Text>
              <strong>Total Revenue:</strong>{" "}
              {formatRevenue(totalRevenueCents)}
            </Text>
            <Text>
              <strong>Total Volume:</strong> {totalVolume} units
            </Text>
          </Section>
          {/* Highlights: up to 3 */}
          {highlights.slice(0, 3).map((h, i) =>
            h.url ? (
              <Img
                key={i}
                src={h.url}
                alt={h.caption}
                width={160}
                style={{ margin: "8px" }}
              />
            ) : null
          )}
          {/* CTA */}
          <Button
            href={reportUrl}
            style={{
              backgroundColor: "#1a1a1a",
              color: "#fff",
              padding: "12px 24px",
              borderRadius: "4px",
              display: "inline-block",
              textDecoration: "none",
            }}
          >
            View Full Report
          </Button>
          <Hr />
          <Text style={{ fontSize: "11px", color: "#999" }}>
            <a href={unsubscribeUrl}>Unsubscribe</a> · Confidential — for{" "}
            {brandName} only
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
