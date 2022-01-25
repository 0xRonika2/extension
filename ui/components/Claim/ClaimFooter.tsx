import React, { Dispatch, ReactElement, SetStateAction } from "react"
import SharedButton from "../Shared/SharedButton"
import SharedProgressIndicator from "../Shared/SharedProgressIndicator"

interface ClaimFooterProps {
  step: number
  setStep: Dispatch<SetStateAction<number>>
  advanceStep: () => void
}

export default function ClaimFooter({
  step,
  setStep,
  advanceStep,
}: ClaimFooterProps): ReactElement {
  const buttonText = [
    "Get started",
    "Continue",
    "Continue",
    "Continue",
    "Claim",
  ]
  return (
    <footer>
      <div className="steps">
        <SharedProgressIndicator
          activeStep={step}
          onProgressStepClicked={() => setStep(step + 1)}
          numberOfSteps={buttonText.length}
        />
      </div>

      <SharedButton type="primary" size="medium" onClick={advanceStep}>
        {buttonText[step - 1]}
      </SharedButton>
      <style jsx>
        {`
          footer {
            position: relative;
            width: 352px;
            z-index: 2;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
          }
          .steps {
            display: flex;
            width: 100px;
          }
          .active {
            width: 16px;
            height: 6px;
            background: var(--trophy-gold);
            border-radius: 100px;
            transition: all 0.5s ease-out;
            margin: 0 2px;
          }
          .inactive {
            width: 6px;
            height: 6px;
            background: var(--green-60);
            border-radius: 100px;
            transition: all 0.5s ease-in;
            margin: 0 2px;
          }
        `}
      </style>
    </footer>
  )
}
