import React, { useState, useEffect } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { formatCurrency } from '@/utils/formatCurrency'
import { getWallets, createWallet, transferFunds, archiveWallet } from '@/services/walletService'
import { 
  Wallet, 
  Plus, 
  ArrowRightLeft, 
  Smartphone, 
  CreditCard, 
  Archive, 
  X, 
  Loader2,
  CheckCircle2,
  TrendingUp
} from 'lucide-react'

/**
 * Trang Quáº£n lĂ½ VĂ­ & Chuyá»ƒn tiá»n ná»™i bá»™ (WalletPage)
 * Phá»¥ trĂ¡ch: TV3 (Nguyá»…n VÅ© Táº¥n Huy) - NhĂ³m chá»©c nÄƒng WALLET (UC06 - UC09)
 */
export const WalletPage = () => {
  const [wallets, setWallets] = useState([])
  const [loading, setLoading] = useState(true)

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Add form
  const [name, setName] = useState('')
  const [type, setType] = useState('cash')
  const [balance, setBalance] = useState('')
  const [color, setColor] = useState('#10B981')

  // Transfer form
  const [fromWalletId, setFromWalletId] = useState('')
  const [toWalletId, setToWalletId] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferNote, setTransferNote] = useState('')

  const fetchWalletsList = async () => {
    try {
      setLoading(true)
      const { data } = await getWallets()
      setWallets(data || [])
      if (data && data.length >= 2) {
        setFromWalletId(data[0].id)
        setToWalletId(data[1].id)
      }
    } catch (err) {
      console.error('Lá»—i khi táº£i danh sĂ¡ch vĂ­:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWalletsList()
  }, [])

  const handleCreateWallet = async (e) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsSubmitting(true)
    try {
      const { error } = await createWallet({
        name,
        type,
        balance: Number(balance) || 0,
        color
      })

      if (error) throw error

      setShowAddModal(false)
      setName('')
      setBalance('')
      await fetchWalletsList()
    } catch (err) {
      alert('Lá»—i táº¡o vĂ­: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTransfer = async (e) => {
    e.preventDefault()
    if (!fromWalletId || !toWalletId || !transferAmount || Number(transferAmount) <= 0) {
      alert('Vui lĂ²ng chá»n vĂ­ vĂ  nháº­p sá»‘ tiá»n há»£p lá»‡')
      return
    }

    if (fromWalletId === toWalletId) {
      alert('VĂ­ nguá»“n vĂ  vĂ­ Ä‘Ă­ch khĂ´ng Ä‘Æ°á»£c trĂ¹ng nhau')
      return
    }

    setIsSubmitting(true)
    try {
      const { error } = await transferFunds({
        fromWalletId,
        toWalletId,
        amount: Number(transferAmount),
        note: transferNote
      })

      if (error) throw error

      setShowTransferModal(false)
      setTransferAmount('')
      setTransferNote('')
      await fetchWalletsList()
      alert('Chuyá»ƒn tiá»n ná»™i bá»™ thĂ nh cĂ´ng!')
    } catch (err) {
      alert('Lá»—i chuyá»ƒn tiá»n: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleArchive = async (walletId) => {
    if (!window.confirm('Báº¡n cĂ³ muá»‘n áº©n vĂ­ nĂ y khá»i danh sĂ¡ch sá»­ dá»¥ng?')) return

    try {
      const { error } = await archiveWallet(walletId)
      if (error) throw error
      await fetchWalletsList()
    } catch (err) {
      alert('Lá»—i khi áº©n vĂ­: ' + err.message)
    }
  }

  const totalBalance = wallets.reduce((sum, w) => sum + Number(w.balance || 0), 0)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="TĂ i sáº£n & Nguá»“n tiá»n"
        title="Quáº£n lĂ½ VĂ­ tiá»n"
        description="Quáº£n lĂ½ cĂ¡c nguá»“n tiá»n máº·t, tĂ i khoáº£n ngĂ¢n hĂ ng vĂ  vĂ­ Ä‘iá»‡n tá»­; thá»±c hiá»‡n chuyá»ƒn tiá»n ná»™i bá»™ giá»¯a cĂ¡c vĂ­."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowTransferModal(true)}
              disabled={wallets.length < 2}
              className="px-3.5 py-2 rounded-full bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 border border-slate-200/80 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Chuyá»ƒn tiá»n ná»™i bá»™</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-soft-sm transition-transform active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>ThĂªm vĂ­ má»›i</span>
            </button>
          </div>
        }
      />

      {/* Total Balance Card */}
      <div className="rounded-[2rem] bg-white/70 p-2 shadow-soft-md ring-1 ring-slate-900/5">
        <div className="rounded-[calc(2rem-0.5rem)] bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-widest font-semibold block mb-1">
              Tá»•ng sá»‘ dÆ° táº¥t cáº£ cĂ¡c vĂ­
            </span>
            <span className="font-display font-extrabold text-3xl sm:text-4xl text-white tracking-tight">
              {formatCurrency(totalBalance)}
            </span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-emerald-300 text-xs font-semibold border border-white/10 self-start sm:self-auto">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{wallets.length} nguá»“n tiá»n hoáº¡t Ä‘á»™ng</span>
          </div>
        </div>
      </div>

      {/* Wallets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 py-12 text-center text-xs text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-brand-600 mx-auto mb-2" />
            <span>Äang táº£i danh sĂ¡ch vĂ­...</span>
          </div>
        ) : wallets.length === 0 ? (
          <div className="col-span-3 py-12 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-100">
            Báº¡n chÆ°a cĂ³ vĂ­ nĂ o. HĂ£y nháº¥n "ThĂªm vĂ­ má»›i" á»Ÿ trĂªn Ä‘á»ƒ báº¯t Ä‘áº§u!
          </div>
        ) : (
          wallets.map((w) => (
            <div
              key={w.id}
              className="rounded-[2rem] bg-white/70 p-2 shadow-soft-md ring-1 ring-slate-900/5 hover:shadow-soft-lg transition-all"
            >
              <div className="rounded-[calc(2rem-0.5rem)] bg-white p-5 border border-slate-100 flex flex-col justify-between h-full">
                
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-xs"
                      style={{ backgroundColor: w.color || '#3B82F6' }}
                    >
                      {w.type === 'bank' ? (
                        <CreditCard className="w-5 h-5" />
                      ) : w.type === 'ewallet' ? (
                        <Smartphone className="w-5 h-5" />
                      ) : (
                        <Wallet className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-display font-bold text-sm text-slate-900">{w.name}</h4>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                        {w.type === 'cash' ? 'Tiá»n máº·t' : w.type === 'bank' ? 'NgĂ¢n hĂ ng' : 'VĂ­ Ä‘iá»‡n tá»­'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleArchive(w.id)}
                    className="w-7 h-7 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors"
                    title="áº¨n vĂ­"
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-baseline justify-between">
                  <span className="text-[11px] text-slate-400 font-medium">Sá»‘ dÆ° hiá»‡n táº¡i</span>
                  <span className="font-display font-black text-lg text-slate-900 tracking-tight">
                    {formatCurrency(w.balance)}
                  </span>
                </div>

              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Wallet Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-display font-bold text-base text-slate-900">ThĂªm VĂ­ Má»›i</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateWallet} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  TĂªn vĂ­ / TĂ i khoáº£n
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VD: Vietcombank, VĂ­ ShopeePay, Tiá»n tiĂªu váº·t..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Loáº¡i vĂ­
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none"
                >
                  <option value="cash">Tiá»n máº·t (Cash)</option>
                  <option value="bank">TĂ i khoáº£n NgĂ¢n hĂ ng (Bank)</option>
                  <option value="ewallet">VĂ­ Ä‘iá»‡n tá»­ (MoMo, ZaloPay...)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Sá»‘ dÆ° ban Ä‘áº§u (VNÄ)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 font-display font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  MĂ u Ä‘áº¡i diá»‡n
                </label>
                <div className="flex items-center gap-2">
                  {['#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#EF4444'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        color === c ? 'scale-110 border-slate-900' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                >
                  Há»§y
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-soft-sm flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Táº¡o vĂ­</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Funds Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-display font-bold text-base text-slate-900">Chuyá»ƒn Tiá»n Ná»™i Bá»™</h3>
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleTransfer} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Tá»« vĂ­ nguá»“n
                  </label>
                  <select
                    value={fromWalletId}
                    onChange={(e) => setFromWalletId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none"
                  >
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>{w.name} ({formatCurrency(w.balance)})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Äáº¿n vĂ­ Ä‘Ă­ch
                  </label>
                  <select
                    value={toWalletId}
                    onChange={(e) => setToWalletId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900 focus:outline-none"
                  >
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Sá»‘ tiá»n chuyá»ƒn (VNÄ)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="VD: 500000"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-sm font-display font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Ghi chĂº chuyá»ƒn khoáº£n
                </label>
                <input
                  type="text"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  placeholder="VD: RĂºt tiá»n ATM, Náº¡p vĂ­ MoMo..."
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-900"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                >
                  Há»§y
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-soft-sm flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>XĂ¡c nháº­n chuyá»ƒn</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
export default WalletPage

