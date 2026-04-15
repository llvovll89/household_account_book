import { ref, uploadBytes, deleteObject, getDownloadURL } from 'firebase/storage'
import { storage } from '../firebase/firebase'

/**
 * 영수증 이미지를 Firebase Storage에 업로드
 * 경로: users/{uid}/receipts/{transactionId}
 */
export async function uploadReceiptImage(
    uid: string,
    transactionId: string,
    file: File
): Promise<string> {
    // 파일 크기 확인 (최대 5MB)
    if (file.size > 5 * 1024 * 1024) {
        throw new Error('파일이 너무 큽니다 (최대 5MB)')
    }

    // 파일 타입 확인
    if (!file.type.startsWith('image/')) {
        throw new Error('이미지 파일만 업로드 가능합니다')
    }

    try {
        // 영수증 이미지 검증 (해상도, 형식)
        await validateReceiptImage(file)

        // 파일 압축
        const compressedFile = await compressImage(file)

        // Storage 경로
        const storageRef = ref(storage, `users/${uid}/receipts/${transactionId}`)

        // 업로드
        await uploadBytes(storageRef, compressedFile, {
            contentType: 'image/jpeg'
        })

        // 다운로드 URL 획득
        const downloadUrl = await getDownloadURL(storageRef)
        return downloadUrl
    } catch (error) {
        throw new Error(`영수증 업로드 실패: ${error instanceof Error ? error.message : ''}`)
    }
}

/**
 * 영수증 이미지 삭제
 */
export async function deleteReceiptImage(uid: string, transactionId: string): Promise<void> {
    try {
        const storageRef = ref(storage, `users/${uid}/receipts/${transactionId}`)
        await deleteObject(storageRef)
    } catch (error) {
        console.error('영수증 삭제 실패:', error)
        // 자동 삭제 실패는 무시 (이미 없을 수 있음)
    }
}

/**
 * 이미지 압축 함수 (Canvas 사용)
 */
async function compressImage(file: File): Promise<File> {
    return new Promise((resolve) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = (e) => {
            const img = new Image()
            img.src = e.target?.result as string
            img.onload = () => {
                const canvas = document.createElement('canvas')
                const maxWidth = 1200
                const maxHeight = 1200
                let width = img.width
                let height = img.height

                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width)
                        width = maxWidth
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height)
                        height = maxHeight
                    }
                }

                canvas.width = width
                canvas.height = height
                const ctx = canvas.getContext('2d')!
                ctx.drawImage(img, 0, 0, width, height)

                canvas.toBlob(
                    (blob) => {
                        const compressedFile = new File([blob!], file.name, { type: 'image/jpeg' })
                        resolve(compressedFile)
                    },
                    'image/jpeg',
                    0.8
                )
            }
        }
    })
}

/**
 * 영수증 이미지 해상도 및 형식 검증
 * - 최소 해상도: 800x600 (스팸 이미지 차단)
 * - 세로 형식: width <= height × 1.1 (일반적인 영수증 형식)
 */
async function validateReceiptImage(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
            const img = new Image()
            img.src = e.target?.result as string

            img.onload = () => {
                // 최소 해상도 확인
                if (img.width < 800 || img.height < 600) {
                    reject(new Error('영수증이 너무 작습니다. 적어도 800x600 이상의 해상도가 필요합니다.'))
                    return
                }

                // 세로 형식 확인 (영수증은 세로)
                const aspectRatio = img.width / img.height
                if (aspectRatio > 1.1) {
                    reject(new Error('세로 형식의 영수증을 업로드해주세요.'))
                    return
                }

                resolve()
            }

            img.onerror = () => {
                reject(new Error('유효하지 않은 이미지 파일입니다.'))
            }
        }

        reader.readAsDataURL(file)
    })
}
