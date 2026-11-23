import { describe, expect, it } from 'vitest'
import { generateVietQrUrl } from '../vietqrService'

describe('Kiểm tra dữ liệu tạo VietQR', () => {
  it('bỏ khoảng trắng trong mã ngân hàng và số tài khoản', () => {
    const url = generateVietQrUrl({
      bankBin: ' 970436 ',
      bankAccount: ' 123 456 789 ',
      amount: 90000,
    })

    expect(url).toContain('/970436-123456789-compact.png')
    expect(new URL(url).searchParams.get('amount')).toBe('90000')
  })

  it('không tạo URL khi mã ngân hàng không hợp lệ', () => {
    expect(generateVietQrUrl({
      bankBin: '123',
      bankAccount: '123456789',
    })).toBe('')
  })

  it('không tạo URL khi số tài khoản có ký tự không hợp lệ', () => {
    expect(generateVietQrUrl({
      bankBin: '970436',
      bankAccount: '../test',
    })).toBe('')
  })

  it('không tạo URL với mẫu QR không được hỗ trợ', () => {
    expect(generateVietQrUrl({
      bankBin: '970436',
      bankAccount: '123456789',
      template: 'invalid-template',
    })).toBe('')
  })

  it('mã hóa nội dung chuyển khoản trong query', () => {
    const url = generateVietQrUrl({
      bankBin: '970436',
      bankAccount: '123456789',
      memo: 'Tiền ăn & nước',
    })

    expect(new URL(url).searchParams.get('addInfo')).toBe('Tiền ăn & nước')
  })
})
