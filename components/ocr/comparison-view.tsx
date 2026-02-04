'use client'

import { useState } from 'react'
import { ZoomIn, ZoomOut, RotateCw } from 'lucide-react'
import { ExtractedSheetData } from '@/lib/ocr-processor'
import Image from 'next/image'

interface ComparisonViewProps {
  images: string[] // Base64 or URLs
  extractedData: ExtractedSheetData
}

export function ComparisonView({ images, extractedData }: ComparisonViewProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5))
  const handleRotate = () => setRotation(prev => (prev + 90) % 360)

  return (
    <div className="grid grid-cols-2 gap-6 h-[600px]">
      {/* Left: Original Image */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Original Document</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleZoomOut}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4 text-slate-600" />
            </button>
            <span className="text-sm text-slate-600 font-mono w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4 text-slate-600" />
            </button>
            <button
              onClick={handleRotate}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Rotate"
            >
              <RotateCw className="h-4 w-4 text-slate-600" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-slate-50 p-4">
          <div className="flex items-center justify-center min-h-full">
            {images.length > 0 ? (
              <div
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transition: 'transform 0.2s ease',
                }}
              >
                <img
                  src={images[currentImageIndex]}
                  alt={`Document page ${currentImageIndex + 1}`}
                  className="max-w-full h-auto shadow-lg"
                />
              </div>
            ) : (
              <p className="text-slate-500">No image uploaded</p>
            )}
          </div>
        </div>

        {images.length > 1 && (
          <div className="p-4 border-t border-slate-200 flex items-center justify-center gap-2">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentImageIndex(index)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  currentImageIndex === index
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Page {index + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: Extracted Data */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">Extracted Data</h3>
          <p className="text-sm text-slate-600 mt-1">
            Confidence: {Math.round(extractedData.confidence * 100)}%
          </p>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Metadata */}
          <div className="bg-slate-50 p-4 rounded-lg">
            <h4 className="font-medium text-slate-900 mb-2">Employee Information</h4>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-600">Name:</dt>
                <dd className="font-medium text-slate-900">{extractedData.metadata.employeeName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">ID:</dt>
                <dd className="font-medium text-slate-900">{extractedData.metadata.employeeId}</dd>
              </div>
              {extractedData.metadata.designation && (
                <div className="flex justify-between">
                  <dt className="text-slate-600">Designation:</dt>
                  <dd className="font-medium text-slate-900">{extractedData.metadata.designation}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-slate-600">Period:</dt>
                <dd className="font-medium text-slate-900">
                  {extractedData.metadata.period.start.toLocaleDateString()} - {extractedData.metadata.period.end.toLocaleDateString()}
                </dd>
              </div>
            </dl>
          </div>

          {/* Pay Events Summary */}
          <div className="bg-slate-50 p-4 rounded-lg">
            <h4 className="font-medium text-slate-900 mb-2">Pay Events ({extractedData.payEvents.length})</h4>
            <div className="space-y-2">
              {extractedData.payEvents.slice(0, 5).map((event, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{event.date.toLocaleDateString()}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    event.type === 'PROMOTION' ? 'bg-purple-100 text-purple-700' :
                    event.type === 'INCREMENT' ? 'bg-blue-100 text-blue-700' :
                    event.type === 'REVISION' ? 'bg-orange-100 text-orange-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {event.type}
                  </span>
                  <span className="font-mono text-slate-900">₹{event.basicPay.toLocaleString()}</span>
                </div>
              ))}
              {extractedData.payEvents.length > 5 && (
                <p className="text-xs text-slate-500 text-center">
                  +{extractedData.payEvents.length - 5} more events
                </p>
              )}
            </div>
          </div>

          {/* Calculations */}
          <div className="bg-slate-50 p-4 rounded-lg">
            <h4 className="font-medium text-slate-900 mb-2">Extracted Calculations</h4>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-600">Total Due:</dt>
                <dd className="font-mono font-medium text-green-600">
                  ₹{extractedData.calculations.totalDue.toLocaleString()}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Total Drawn:</dt>
                <dd className="font-mono font-medium text-red-600">
                  ₹{extractedData.calculations.totalDrawn.toLocaleString()}
                </dd>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-300">
                <dt className="font-semibold text-slate-900">Net Arrear:</dt>
                <dd className="font-mono font-bold text-indigo-600">
                  ₹{extractedData.calculations.netArrear.toLocaleString()}
                </dd>
              </div>
            </dl>
          </div>

          {/* Raw OCR Text (Collapsible) */}
          <details className="bg-slate-50 p-4 rounded-lg">
            <summary className="font-medium text-slate-900 cursor-pointer">Raw OCR Text</summary>
            <pre className="mt-2 text-xs text-slate-600 whitespace-pre-wrap max-h-40 overflow-auto">
              {extractedData.rawOCRText}
            </pre>
          </details>
        </div>
      </div>
    </div>
  )
}
