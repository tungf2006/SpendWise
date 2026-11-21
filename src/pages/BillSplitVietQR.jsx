import React, { useState, useEffect } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { formatCurrency } from '@/utils/formatCurrency'
import { useAuth } from '@/context/AuthContext'
import { POPULAR_BANKS, generateVietQrUrl, splitBill } from '@/services/vietqrService'
import { QrCode, Users, DollarSign, Download, Copy, Check, CreditCard, Sparkles } from 'lucide-react'

/**
 * Trang Chia hóa đơn & Tạo mã VietQR (BillSplitVietQR)
 * Phụ trách: TV1 (Trương Bích Vân) - Nhóm chức năng NOTI_QR (UC26)
 */
export const BillSplitVietQR = () => {
  const { profile } = useAuth()

  // Bill split state
  const [totalAmount, setTotalAmount] = useState('360000')
  const [numberOfPeople, setNumberOfPeople] = useState(4)
  const [tipPercent, setTipPercent] = useState(0)

  // Bank & VietQR state
  const [bankBin, setBankBin] = useState('970436') // Default VCB
  const [bankAccount, setBankAccount] = useState('')
  const [memo, setMemo] = useState('Tien an toi nhom')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (profile?.default_bank_bin) {
      setBankBin(profile.default_bank_bin)
    }
    if (profile?.default_bank_account) {
      setBankAccount(profile.default_bank_account)
    }
  }, [profile])

  const splitResult = splitBill({
    totalAmount: Number(totalAmount) || 0,
    numberOfPeople: Number(numberOfPeople) || 1,
    tipPercent: Number(tipPercent) || 0
  })

  const qrUrl = generateVietQrUrl({
    bankBin,
    bankAccount,
    amount: splitResult.amountPerPerson,
    memo: memo || 'SpendWise Chia tien',
    template: 'compact'
  })

  const handleCopyMemo = () => {
    navigator.clipboard.writeText(memo)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tiện ích thanh toán"
        title="Chia Hóa Đơn & Tạo VietQR"
        description="Chia đều tiền ăn uống, cafe nhóm và tự động sinh mã VietQR chuẩn Napas247 để bạn bè quét mã chuyển khoản tức thì."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Form: Calculator & Bank Details */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Bill Split Section */}
          <div className="rounded-[2rem] bg-white/70 p-2 shadow-soft-md ring-1 ring-slate-900/5">
            <div className="rounded-[calc(2rem-0.5rem)] bg-white p-6 border border-slate-100 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-brand-600" />
                <h3 className="font-display font-bold text-sm text-slate-900 uppercase tracking-wider">
                  Thông tin Chia tiền (Bill Split)
                </h3>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tổng tiền hóa đơn (VNĐ)
                </label>
                <input
                  type="number"
                  min="1000"
                  step="5000"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-base font-display font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Số người chia đều
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={numberOfPeople}
                    onChange={(e) => setNumberOfPeople(Math.max(1, Number(e.target.value)))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm font-semibold text-slate-900 text-center"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Phí dịch vụ / Tip (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={tipPercent}
                    onChange={(e) => setTipPercent(Math.max(0, Number(e.target.value)))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm font-semibold text-slate-900 text-center"
                  />
                </div>
              </div>

              {/* Calculated per person highlight */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-brand-50 to-emerald-50 border border-brand-200/60 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 block">Mỗi người cần chuyển</span>
                  <span className="font-display font-black text-2xl text-brand-700 tracking-tight">
                    {formatCurrency(splitResult.amountPerPerson)}
                  </span>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <span>Tổng chia: {formatCurrency(splitResult.totalAmountWithTip)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Receiving Bank Section */}
          <div className="rounded-[2rem] bg-white/70 p-2 shadow-soft-md ring-1 ring-slate-900/5">
            <div className="rounded-[calc(2rem-0.5rem)] bg-white p-6 border border-slate-100 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-4 h-4 text-brand-600" />
                <h3 className="font-display font-bold text-sm text-slate-900 uppercase tracking-wider">
                  Tài khoản Thụ hưởng tạo VietQR
                </h3>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Ngân hàng thụ hưởng
                </label>
                <select
                  value={bankBin}
                  onChange={(e) => setBankBin(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none"
                >
                  {POPULAR_BANKS.map((b) => (
                    <option key={b.bin} value={b.bin}>{b.shortName} - {b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Số tài khoản nhận tiền
                </label>
                <input
                  type="text"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  placeholder="Nhập số tài khoản ngân hàng của bạn..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nội dung chuyển khoản (Memo)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopyMemo}
                    className="px-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Đã sao chép' : 'Chép'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right Preview: VietQR Card */}
        <div className="lg:col-span-5">
          <div className="rounded-[2.25rem] bg-gradient-to-b from-slate-900 to-slate-950 p-2 shadow-soft-xl text-white">
            <div className="rounded-[calc(2.25rem-0.5rem)] bg-white p-6 text-slate-900 flex flex-col items-center text-center">
              
              <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                <QrCode className="w-4 h-4 text-brand-600" />
                <span>Mã VietQR Thanh Toán Napas247</span>
              </div>

              {bankAccount ? (
                <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-sm mb-4">
                  <img
                    src={qrUrl}
                    alt="VietQR Code"
                    className="w-64 h-auto max-w-full rounded-lg mx-auto"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className="w-64 h-64 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-6 text-slate-400 text-xs mb-4">
                  <QrCode className="w-10 h-10 mb-2 opacity-40" />
                  <span>Vui lòng nhập Số tài khoản ngân hàng bên cạnh để hiển thị mã QR</span>
                </div>
              )}

              <div className="w-full space-y-1.5 py-3 border-t border-slate-100 text-xs text-left">
                <div className="flex justify-between">
                  <span className="text-slate-400">Số tiền mỗi người:</span>
                  <span className="font-display font-bold text-brand-600 text-sm">
                    {formatCurrency(splitResult.amountPerPerson)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Nội dung:</span>
                  <span className="font-semibold text-slate-700">{memo || 'SpendWise'}</span>
                </div>
              </div>

              {bankAccount && (
                <a
                  href={qrUrl}
                  download="vietqr_spendwise.png"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full mt-2 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-transform active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>Tải ảnh mã QR</span>
                </a>
              )}

            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
export default BillSplitVietQR
