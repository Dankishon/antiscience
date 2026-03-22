import { ResultSummary } from '../../components/result-summary';

export default async function ResultPage({
  searchParams,
}: {
  searchParams: Promise<{ responseId?: string }>;
}) {
  const params = await searchParams;

  return <ResultSummary responseId={params.responseId ?? null} />;
}
