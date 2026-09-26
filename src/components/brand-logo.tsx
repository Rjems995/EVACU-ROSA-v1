export default function BrandLogo({ large = false }: { large?: boolean }) {
  // The adjacent brand text names the link; keep this matching emblem decorative.
  return (
    <img
      className={large ? 'brand-logo brand-logo-large' : 'brand-logo'}
      src="/logo.svg"
      alt=""
      width={large ? 104 : 64}
      height={large ? 104 : 64}
    />
  );
}
