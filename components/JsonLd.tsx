type JsonLdProps = {
  data: Record<string, unknown>;
};

/** Renders structured data (schema.org) for search engines and AI agents. */
export default function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
