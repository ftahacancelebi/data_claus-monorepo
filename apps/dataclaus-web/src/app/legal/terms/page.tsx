export const metadata = {
  title: 'Kullanım Koşulları — DataClaus',
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-slate-200">
      <h1 className="mb-6 text-3xl font-semibold">Kullanım Koşulları</h1>
      <p className="mb-4 text-sm text-slate-400">
        Son güncelleme: 29 Nisan 2026
      </p>
      <section className="space-y-4 leading-relaxed">
        <h2 className="mt-8 text-xl font-semibold">1. Hizmet</h2>
        <p>
          DataClaus, geliştiricilerin kullanıcıların onayıyla anonim
          sensör verisi toplamasına ve gelir paylaşımı yapmasına olanak
          tanıyan bir SDK + platform sunar. Hizmet &ldquo;olduğu
          gibi&rdquo; sunulur, kesintisiz ya da hatasız çalışacağı
          garanti edilmez.
        </p>

        <h2 className="mt-8 text-xl font-semibold">2. Kullanıcı Yükümlülükleri</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>Hesabınızın güvenliğinden siz sorumlusunuz</li>
          <li>Sahte / bot trafiği üretmek yasaktır (kalite skoru ile tespit edilir)</li>
          <li>API anahtarlarını güvende tutun, sızdırırsanız <em>hemen</em> rotate edin</li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold">3. Gelir Paylaşımı</h2>
        <p>
          Reklam ve sensör verisi gelirleri, geliştirici tarafından
          uygulama düzeyinde ayarlanan oranlarda dağıtılır. Platform
          ücreti sabit %5&apos;tir. Detaylar geliştirici panelinde
          görünür.
        </p>

        <h2 className="mt-8 text-xl font-semibold">4. Hesap Sonlandırma</h2>
        <p>
          Hesabınızı istediğiniz zaman silebilirsiniz (
          <a className="text-emerald-400 underline" href="/legal/data-rights">veri hakları sayfası</a>
          ). 30 günlük cooling-off süresi içinde geri alınabilir.
        </p>
      </section>
    </main>
  );
}
