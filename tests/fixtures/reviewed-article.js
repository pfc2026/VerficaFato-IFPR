import { articleContentHash } from '../../services/article-eligibility.js';

// A controlled article reviewed for provenance, never factual proof.
export function reviewedArticle(value = {}) {
  const record = {titulo:'Reportagem regional controlada',texto:'Uma reportagem contextual controlada com corpo delimitado e atribuição identificada.',fonte:'Portal controlado',url:'https://regional.example.org/reportagem',...value};
  const hash=articleContentHash(record);
  return {...record,content_hash:hash,
    proveniencia:{tipo:'artigo',metodo:'revisao_documentada',urlOrigem:new URL(record.url).href,content_hash:hash},
    revisao:{estado:'aprovado',em:'2026-11-15',url:new URL(record.url).href,content_hash:hash,referencia:'Fixture controlada: identidade de artigo, sem confirmação factual.'}
  };
}
