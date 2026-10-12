import logoPrimary from '../assets/brand/logo-primary.webp';
import logoPrimary840 from '../assets/brand/logo-primary-840.webp';
import logoMark from '../assets/brand/logo-mark.webp';

/**
 * The official Disc Golf Bag Tips logos, as supplied in the logo kit.
 *
 * These render the brand's own artwork (see brand/README.md for how each file
 * is cropped from the originals) rather than recreating it. The images are
 * transparent, Forest-coloured artwork; on dark backgrounds CSS shows the kit's
 * single-colour white version.
 */

/** 01 Primary logo: monogram + DiscGolfBagTips wordmark. */
export function PrimaryLogo({ height = 40 }: { height?: number }) {
  return (
    <img
      className="brand-logo"
      src={logoPrimary840}
      srcSet={`${logoPrimary840} 840w, ${logoPrimary} 1709w`}
      sizes={`${Math.round((height * 1709) / 326)}px`}
      width={Math.round((height * 1709) / 326)}
      height={height}
      alt="Disc Golf Bag Tips"
      decoding="async"
    />
  );
}

/** 02 Secondary logo: the DG/BT monogram alone, for tight spaces. */
export function LogoMark({ height = 40, alt = '' }: { height?: number; alt?: string }) {
  return (
    <img
      className="brand-logo"
      src={logoMark}
      width={Math.round((height * 304) / 326)}
      height={height}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      decoding="async"
    />
  );
}
