import { useEffect, useRef, useState } from 'react'
import { BottomBar } from '../components/BottomBar'
import { CameraIcon, ImageIcon, ReceiptIcon } from '../components/Icons'
import { billFromScan } from '../lib/bills'
import { compressImage } from '../lib/image'
import { scanReceipt } from '../lib/scan'
import type { StepProps } from './props'

type Status = { kind: 'idle' } | { kind: 'scanning' } | { kind: 'error'; message: string }

export function ScanStep({ update, onNext }: StepProps) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [preview, setPreview] = useState<string | null>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const galleryInput = useRef<HTMLInputElement>(null)

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])

  async function handleFile(file: File | undefined) {
    if (!file) return
    setPreview(URL.createObjectURL(file))
    setStatus({ kind: 'scanning' })
    try {
      const image = await compressImage(file)
      const receipt = await scanReceipt(image)
      update((b) => billFromScan(b, receipt))
      onNext()
    } catch (e) {
      setStatus({ kind: 'error', message: (e as Error).message })
    }
  }

  const scanning = status.kind === 'scanning'

  return (
    <div className="screen">
      <div className="glass dropzone">
        {preview ? (
          <>
            <img src={preview} alt="Receipt photo" />
            {scanning && (
              <>
                <div className="scanline" />
                <div className="scan-status" role="status">
                  <div className="spinner" />
                  Reading the receipt… this takes a few seconds
                </div>
              </>
            )}
          </>
        ) : (
          <div>
            <div className="hero-icon">
              <ReceiptIcon />
            </div>
            <h2>Photograph the receipt</h2>
            <p className="small" style={{ margin: '6px 0 0' }}>
              Lay it flat in good light, with the whole receipt in the frame.
            </p>
          </div>
        )}
      </div>

      {status.kind === 'error' && <div className="notice notice-bad">{status.message}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <button className="btn" disabled={scanning} onClick={() => cameraInput.current?.click()}>
          <CameraIcon /> Camera
        </button>
        <button className="btn" disabled={scanning} onClick={() => galleryInput.current?.click()}>
          <ImageIcon /> Photos
        </button>
      </div>

      <input
        ref={cameraInput}
        className="sr-only"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <input
        ref={galleryInput}
        className="sr-only"
        type="file"
        accept="image/*"
        onChange={(e) => {
          handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      <BottomBar>
        <button className="btn btn-ghost btn-block" disabled={scanning} onClick={onNext}>
          Type the items instead
        </button>
      </BottomBar>
    </div>
  )
}
