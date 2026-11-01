interface Props {
  isIosManualInstall: boolean
  installGuideText: string
  canPrompt: boolean
  onLater: () => void
  onInstall: () => void
}

export default function InstallOffer({ isIosManualInstall, installGuideText, canPrompt, onLater, onInstall }: Props) {
  return (
    <section className="install-offer rounded-2xl px-4 py-3.5 shadow-sm" aria-label="앱 설치 안내">
      <p className="text-sm font-semibold">앱처럼 빠르게 사용하려면 홈 화면에 추가하세요.</p>
      <p className="install-offer-description text-xs mt-1 leading-relaxed">
        {isIosManualInstall ? installGuideText : '설치 버튼을 눌러 잔고플랜 앱을 설치할 수 있어요.'}
      </p>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button type="button" onClick={onLater} className="install-offer-later min-h-11 px-3 rounded-xl text-xs font-bold">나중에</button>
        {!isIosManualInstall && canPrompt && (
          <button type="button" onClick={onInstall} className="install-offer-action min-h-11 px-3 rounded-xl text-xs font-bold">설치</button>
        )}
      </div>
    </section>
  )
}
