export const dynamic = 'force-dynamic';

import { buildOrganisationsData } from '@/lib/organisations';
import OrganisationsSectorChart from '@/components/OrganisationsSectorChart';
import OrganisationsTable from '@/components/OrganisationsTable';
import DataLoadError from '@/components/DataLoadError';

export default async function OrganisationsPage() {
  try {
    const data = await buildOrganisationsData();
    return (
      <main className="min-h-screen bg-[#fcf2e3] px-4 sm:px-8 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#212122]"
                style={{ fontFamily: 'Inria Serif, serif' }}>
              Partner Organisations
            </h1>
            <p className="text-sm text-[#8a7a6a] font-[Geist] mt-1">
              FY 2026/27 · Advisory and Programmes income by organisation
            </p>
          </div>
          <OrganisationsSectorChart sectors={data.sectors} />
          <OrganisationsTable data={data} />
        </div>
      </main>
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return (
      <main className="min-h-screen bg-[#fcf2e3] px-4 sm:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-[#212122] mb-4"
              style={{ fontFamily: 'Inria Serif, serif' }}>
            Partner Organisations
          </h1>
          <DataLoadError error={message} />
        </div>
      </main>
    );
  }
}
