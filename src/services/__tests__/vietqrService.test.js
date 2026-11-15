import { describe, it, expect } from 'vitest'
import { splitBill, generateVietQrUrl } from '../vietqrService.js'

describe('vietqrService (UC26)', () => {
  it('chia hóa đơn kèm % tip và làm tròn lên cho mỗi người', () => {
    const result = splitBill({
      totalAmount: 100000,
      numberOfPeople: 3,
      tipPercent: 10
    })

    expect(result.tipAmount).toBe(10000)
    expect(result.totalAmountWithTip).toBe(110000)
    expect(result.amountPerPerson).toBe(36667)
    expect(result.numberOfPeople).toBe(3)
  })

  it('bảo vệ đầu vào âm hoặc số người <= 0 về giá trị an toàn', () => {
    const result = splitBill({ totalAmount: -50000, numberOfPeople: 0, tipPercent: -10 })
    expect(result.totalAmountWithTip).toBe(0)
    expect(result.amountPerPerson).toBe(0)
    expect(result.numberOfPeople).toBe(1)
  })

  it('sinh URL img.vietqr.io đúng tham số và trả chuỗi rỗng khi thiếu thông tin ngân hàng', () => {
    expect(generateVietQrUrl({ bankBin: '', bankAccount: '123456' })).toBe('')

    const url = generateVietQrUrl({
      bankBin: '970436',
      bankAccount: '0123456789',
      amount: 150000,
      memo: 'Chia tien an trua',
      accountName: 'Phan Thanh Tung',
      template: 'compact2'
    })

    expect(url).toContain('https://img.vietqr.io/image/970436-0123456789-compact2.png')
    expect(url).toContain('amount=150000')
    expect(url).toContain('addInfo=Chia+tien+an+trua')
    expect(url).toContain('accountName=PHAN+THANH+TUNG')
  })
})
