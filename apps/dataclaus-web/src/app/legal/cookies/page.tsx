export const metadata = {
  title: 'Çerez Politikası — DataClaus',
};

export default function CookiesPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-slate-200">
      <h1 className="mb-6 text-3xl font-semibold">Çerez Politikası</h1>

      <section className="space-y-4 leading-relaxed">
        <h2 className="mt-8 text-xl font-semibold">Hangi Çerezleri Kullanıyoruz?</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-left">
              <th className="py-2 pr-4">Çerez</th>
              <th className="py-2 pr-4">Amaç</th>
              <th className="py-2">Süre</th>
            </tr>
          </thead>
          <tbody className="text-slate-300">
            <tr className="border-b border-slate-800">
              <td className="py-2 pr-4 font-mono">dc_session</td>
              <td className="py-2 pr-4">Oturum yönetimi (zorunlu)</td>
              <td className="py-2">Oturum</td>
            </tr>
            <tr className="border-b border-slate-800">
              <td className="py-2 pr-4 font-mono">dc_consent</td>
              <td className="py-2 pr-4">Çerez tercihleri</td>
              <td className="py-2">12 ay</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-mono">dc_analytics</td>
              <td className="py-2 pr-4">İsteğe bağlı kullanım analizi</td>
              <td className="py-2">12 ay</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-6 text-slate-400">
          Reddederseniz analitik çerezler hiç oluşturulmaz. Zorunlu
          çerezler hizmetin çalışması için gereklidir.
        </p>
      </section>
    </main>
  );
}
