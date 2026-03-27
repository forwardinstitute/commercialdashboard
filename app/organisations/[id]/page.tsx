export const dynamic = 'force-dynamic';

import { buildOrganisationsData } from '@/lib/organisations';
import { getAdvisoryOpportunities, getProgrammeOpportunities } from '@/lib/salesforce';
import OrganisationDetail from '@/components/OrganisationDetail';
import Link from 'next/link';

interface Props { params: Promise<{ id: string }> }

export default async function OrganisationDetailPage({ params }: Props) {
  const { id } = await params;

  try {
    const [orgData, advisoryOpps, rawProgrammeOpps] = await Promise.all([
      buildOrganisationsData(),
      getAdvisoryOpportunities(),
      getProgrammeOpportunities(),
    ]);

    const org = orgData.organisations.find(o => o.accountId === id);
    if (!org) {
      return (
        <main className="min-h-screen bg-[#fcf2e3] px-4 sm:px-8 py-8">
          <div className="max-w-5xl mx-auto">
            <Link href="/organisations" className="text-sm text-[#8a7a6a] font-[Geist] hover:text-[#212122] mb-4 inline-block">
              ← Partner Organisations
            </Link>
            <p className="text-[#dd6945] font-[Geist]">Organisation not found.</p>
          </div>
        </main>
      );
    }

    // Filter opps for this account
    const orgAdvisoryOpps = advisoryOpps.filter(o => o.Account?.Id === id);

    const isOldFellowship = (o: typeof rawProgrammeOpps[0]) => {
      const name = (o.Programme__r?.Name ?? '').toLowerCase();
      return name.includes('fellowship') && !name.includes('fellowship programme 2026');
    };
    const orgProgrammeOpps = rawProgrammeOpps.filter(o =>
      o.Account?.Id === id &&
      !(o.Programme__r?.Name ?? '').includes('Advisory Practice') &&
      !isOldFellowship(o)
    );

    return (
      <main className="min-h-screen bg-[#fcf2e3] px-4 sm:px-8 py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <Link href="/organisations" className="text-sm text-[#8a7a6a] font-[Geist] hover:text-[#212122] inline-block">
            ← Partner Organisations
          </Link>
          <OrganisationDetail
            org={org}
            advisoryOpps={orgAdvisoryOpps}
            programmeOpps={orgProgrammeOpps}
          />
        </div>
      </main>
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return (
      <main className="min-h-screen bg-[#fcf2e3] px-4 sm:px-8 py-8">
        <div className="max-w-5xl mx-auto">
          <Link href="/organisations" className="text-sm text-[#8a7a6a] font-[Geist] hover:text-[#212122] mb-4 inline-block">
            ← Partner Organisations
          </Link>
          <div className="fi-card border-l-4 border-[#dd6945]">
            <p className="font-semibold text-[#dd6945] mb-1">Unable to load organisation data</p>
            <pre className="text-xs text-[#8a7a6a] whitespace-pre-wrap">{message}</pre>
          </div>
        </div>
      </main>
    );
  }
}
