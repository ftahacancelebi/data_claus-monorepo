export const metadata = {
  title: 'Gizlilik Politikası — DataClaus',
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-slate-200">
      <h1 className="mb-6 text-3xl font-semibold">Gizlilik Politikası</h1>
      <p className="mb-4 text-sm text-slate-400">
        Son güncelleme: 29 Nisan 2026
      </p>

      <section className="space-y-4 leading-relaxed">
        <h2 className="mt-8 text-xl font-semibold">1. Veri Sahibi Kim?</h2>
        <p>
          DataClaus, kullanıcının (&ldquo;veri sahibi&rdquo;)
          mobil cihazından topladığı sensör ve davranış verilerini
          işler. Bu verilerin sahibi <strong>her zaman sizsiniz</strong>.
          Platform, bu verileri sizin onayınızla anonim olarak işler ve
          gelirin <strong>%70-90</strong>&apos;ını size aktarır.
        </p>

        <h2 className="mt-8 text-xl font-semibold">2. Hangi Verileri İşliyoruz?</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>İvmeölçer / jiroskop / dokunma örnekleri (kalite skoru için)</li>
          <li>E-posta adresi (giriş için)</li>
          <li>Cüzdan bakiyesi ve işlem geçmişi</li>
          <li>Oturum meta verisi (IP, kullanıcı ajanı, son giriş zamanı)</li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold">3. Haklarınız (KVKK Md. 11 / GDPR Md. 15-22)</h2>
        <ul className="list-disc space-y-2 pl-6">
          <li>İşlenen kişisel verilerinizi öğrenme</li>
          <li>Verilerinizin kopyasını JSON formatında dışa aktarma (
            <a className="text-emerald-400 underline" href="/legal/data-rights">veri hakları sayfası</a>
            )</li>
          <li>Verilerinizin silinmesini talep etme (30 günlük geri alma süresi vardır)</li>
          <li>Yanlış verilerinizin düzeltilmesini isteme</li>
          <li>İşlenmeye itiraz etme</li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold">4. Saklama Süresi</h2>
        <p>
          Aktif hesabınız boyunca verileriniz saklanır. Hesap silme
          talebi sonrası 30 günlük geri alma süresinin ardından kalıcı
          olarak silinir; ledger geçmişi anonimleştirilmiş olarak
          finansal bütünlük gereği saklanır.
        </p>

        <h2 className="mt-8 text-xl font-semibold">5. İletişim</h2>
        <p>
          Tüm DSAR talepleri için: <a className="text-emerald-400 underline" href="mailto:privacy@dataclaus.example">privacy@dataclaus.example</a>
        </p>
      </section>
    </main>
  );
}
