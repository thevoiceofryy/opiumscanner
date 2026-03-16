'use client'

import { Button } from '@/components/ui/button'

export function CheckoutButton() {

  const copyAddress = () => {
    navigator.clipboard.writeText("5ZGfZpXoDZMfB6f9v9jZ1igmiPz4Sm5urpiTshm48LF6")
    alert("Address copied")
  }

  return (
    <div className="space-y-3 text-sm">

      <div className="border rounded p-3">
        <div className="font-semibold">Send $50 in SOL</div>

        <div className="text-xs mt-2 break-all">
        5ZGfZpXoDZMfB6f9v9jZ1igmiPz4Sm5urpiTshm48LF6
        </div>

        <Button className="w-full mt-3" onClick={copyAddress}>
          Copy Address
        </Button>
      </div>

      <div className="text-xs text-muted-foreground">
        After sending payment click "Unlock now".
      </div>

    </div>
  )
}