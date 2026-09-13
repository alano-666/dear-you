import Link from "next/link";

export default function DeliverPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 md:px-8">
      <header className="pt-12 text-center md:pt-20">
        <h1 className="text-xl font-medium text-sea-deep md:text-2xl">选择你的送达方式</h1>
        <p className="mt-3 text-sm text-ink-soft">
          这封信,想以哪种方式送到你手中?
        </p>
      </header>

      <div className="mt-10 grid gap-4 md:mt-14 md:grid-cols-3 md:gap-5">
        <DeliveryCard
          label="微信卡片"
          desc="分享到微信好友 / 朋友圈"
          preview={
            <div className="flex h-24 items-center rounded-xl border border-[#cfe6d8] bg-[#f4fbf6] px-3">
              <div className="w-full rounded-lg bg-white p-2.5 shadow-[0_2px_8px_rgba(20,48,75,0.06)]">
                <div className="h-2 w-16 rounded-full bg-[#95d3ae]" />
                <div className="mt-2 h-1.5 w-full rounded-full bg-sea-mist" />
                <div className="mt-1.5 h-1.5 w-3/5 rounded-full bg-sea-mist" />
              </div>
            </div>
          }
        />
        <DeliveryCard
          label="邮件版式"
          desc="发送到你的邮箱"
          preview={
            <div className="flex h-24 flex-col justify-center rounded-xl border border-sea-mist bg-white px-4">
              <div className="h-1.5 w-14 rounded-full bg-sea/40" />
              <div className="mt-2.5 h-1.5 w-full rounded-full bg-sea-mist" />
              <div className="mt-1.5 h-1.5 w-4/5 rounded-full bg-sea-mist" />
              <div className="mt-1.5 h-1.5 w-2/5 rounded-full bg-sea-mist" />
            </div>
          }
        />
        <DeliveryCard
          label="实体信封"
          desc="打印成信纸,寄给未来的你"
          preview={
            <div className="flex h-24 items-center justify-center rounded-xl border border-[#e6dbc4] bg-[#faf5ea]">
              <div className="relative h-14 w-20 rounded-sm bg-[#f3ead6] shadow-[0_2px_6px_rgba(20,48,75,0.08)]">
                <div className="absolute inset-x-0 top-0 h-7 origin-top-left [clip-path:polygon(0_0,100%_0,50%_100%)] bg-[#eadfc4]" />
                <div className="absolute bottom-2 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-dawn/70" />
              </div>
            </div>
          }
        />
      </div>

      <p className="mt-8 text-center font-letter text-sm text-ink-soft/80">
        无论哪种方式,都是我想对你说的话。
      </p>

      {/* 收尾 */}
      <section className="mt-24 mb-8 text-center md:mt-36">
        <p className="font-letter text-3xl tracking-[0.1em] text-sea md:text-4xl">明天见</p>
        <p className="mt-6 text-sm leading-7 text-ink-soft">
          我会继续
          <br />
          收集你的生活,写给你
        </p>
        <Link
          href="/"
          className="mt-10 inline-block rounded-full border border-sea/25 px-6 py-2 text-sm text-sea transition-colors hover:bg-sea-mist/50"
        >
          再交给它一件小事
        </Link>
      </section>
    </div>
  );
}

function DeliveryCard({
  label,
  desc,
  preview,
}: {
  label: string;
  desc: string;
  preview: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-sea-mist bg-white/70 p-4">
      {preview}
      <p className="mt-4 text-[15px] font-medium text-sea-deep">{label}</p>
      <p className="mt-1 text-[13px] text-ink-soft">{desc}</p>
    </div>
  );
}
