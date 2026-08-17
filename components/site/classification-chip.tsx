import {
  SITE_CLASSIFICATION_FILL,
  SITE_CLASSIFICATION_LABELS,
  type SiteClassification,
} from "@/lib/site/classification";

/**
 * O selo de classificação — o mesmo preenchimento sólido do cartão de achado
 * da ronda. Serve de vocabulário compartilhado entre `products.tsx` e
 * `state-ledger.tsx`: um produto e um órgão do sistema são classificados pela
 * mesma régua, e precisam parecer classificados pela mesma régua.
 */
export function ClassificationChip({
  classification,
  className = "",
}: {
  classification: SiteClassification;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 font-[family-name:var(--luna-mono)] text-[0.6875rem] font-semibold uppercase tracking-[0.05em] ${SITE_CLASSIFICATION_FILL[classification]} ${className}`}
    >
      {SITE_CLASSIFICATION_LABELS[classification]}
    </span>
  );
}
