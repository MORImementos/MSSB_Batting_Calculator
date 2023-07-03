import { inMemBatter, Lefty, Display_Output, LeftSour, LeftNice, Perfect, RightNice, RightSour, Slap, Charge, SourSlap, PerfectSlap, NiceSlap, inMemPitcher, PitchChargeType_Perfect, PerfectPitchSourSlap, PerfectPitchSourCharge, PitchCurve, SourCharge, SourChangeUpSlap, SourChangeUpCharge } from "../index";

import { contact_ChemLinkMultipliers, BatterHitbox, BallContactArray_807b6294, ContactPerfectThresholds } from "../data/constants";


export function calculateContact() {
  let chargeUp = inMemBatter.BatterAtPlate_BatterCharge_Up;
  let contactSize = inMemBatter.Batter_SlapContactSize;
  if (inMemBatter.AtBat_Mystery_CaptainStarSwing != 0) {
    // if there was a star swing, make contact size 100
    chargeUp = 0;
    contactSize = 100;
  }
  if (inMemBatter.Batter_IsBunting == false) {
    if (chargeUp <= 0) {
      // If not charging
      if (inMemBatter.RandomBattingFactors_ChemLinksOnBase != 0) {
        // If there are chem links on base, make the contact size larger
        contactSize *=
          contact_ChemLinkMultipliers[inMemBatter.RandomBattingFactors_ChemLinksOnBase];
      }
    } else {
      // else there is a charge
      contactSize = inMemBatter.Batter_ChargeContactSize;
    }
  } else {
    // else bunting, use bunting contact size
    contactSize = inMemBatter.Batter_Bunting;
  }

  let diffInX = inMemBatter.interstitialBallContact_X - inMemBatter.posX;
  if (inMemBatter.AtBat_BatterHand == Lefty) {
    diffInX = -diffInX;
  }

  Display_Output["DiffInX"] = diffInX;

  if (diffInX >= 0) {
    inMemBatter.CalculatedBallPos =
      100 *
      (diffInX / BatterHitbox[inMemBatter.Batter_CharID].HorizontalRangeFar) +
      100;
  } else {
    inMemBatter.CalculatedBallPos = -(
      100 *
      (diffInX /
        BatterHitbox[inMemBatter.Batter_CharID].HorizontalRangeNear) -
      100
    );
  }

  if (inMemBatter.CalculatedBallPos < 0) {
    inMemBatter.CalculatedBallPos = 0;
  }
  if (200 < inMemBatter.CalculatedBallPos) {
    inMemBatter.CalculatedBallPos = 200;
  }

  Display_Output["Contact Point"] = inMemBatter.CalculatedBallPos;

  // Higher is better, makes ranges larger
  contactSize = contactSize / 100;
  // Contact sizes are only based on slap/charge and trimming, and AI
  let big_Array = BallContactArray_807b6294[inMemBatter.AtBat_TrimmedBat][inMemBatter.Batter_Contact_SlapChargeBuntStar][inMemBatter.EasyBatting];
  let b0 = big_Array[0];
  let b1 = big_Array[1];
  let b2 = big_Array[2];
  let b3 = big_Array[3];

  inMemBatter.LeftNiceThreshold = contactSize * (big_Array[4] - b0) + b0;
  inMemBatter.LeftPerfectThreshold = contactSize * (big_Array[5] - b1) + b1;
  inMemBatter.RightPerfectThreshold = contactSize * (big_Array[6] - b2) + b2;
  inMemBatter.RightNiceThreshold = contactSize * (big_Array[7] - b3) + b3;

  Display_Output.LeftNiceThreshold = inMemBatter.LeftNiceThreshold;
  Display_Output.LeftPerfectThreshold = inMemBatter.LeftPerfectThreshold;
  Display_Output.RightPerfectThreshold = inMemBatter.RightPerfectThreshold;
  Display_Output.RightNiceThreshold = inMemBatter.RightNiceThreshold;

  inMemBatter.Batter_ContactType = LeftSour;
  if (inMemBatter.LeftNiceThreshold <= inMemBatter.CalculatedBallPos) {
    inMemBatter.Batter_ContactType = LeftNice;

    if (inMemBatter.LeftPerfectThreshold <= inMemBatter.CalculatedBallPos) {
      inMemBatter.Batter_ContactType = Perfect;

      if (inMemBatter.RightPerfectThreshold <= inMemBatter.CalculatedBallPos) {
        inMemBatter.Batter_ContactType = RightNice;

        if (inMemBatter.RightNiceThreshold <= inMemBatter.CalculatedBallPos) {
          inMemBatter.Batter_ContactType = RightSour;
        }
      }
    }
  }

  if (inMemBatter.Batter_ContactType == Perfect) {
    if (inMemBatter.CalculatedBallPos >= 100) {
      inMemBatter.ContactQuality =
        1 -
        (inMemBatter.CalculatedBallPos - inMemBatter.LeftPerfectThreshold) /
        (inMemBatter.RightPerfectThreshold -
          inMemBatter.LeftPerfectThreshold);
    } else {
      inMemBatter.ContactQuality =
        (inMemBatter.CalculatedBallPos - inMemBatter.LeftPerfectThreshold) /
        (inMemBatter.RightPerfectThreshold - inMemBatter.LeftPerfectThreshold);
    }
    if (ContactPerfectThresholds[inMemBatter.Batter_Contact_SlapChargeBuntStar][0] <= inMemBatter.CalculatedBallPos &&
      inMemBatter.CalculatedBallPos <=
      ContactPerfectThresholds[inMemBatter.Batter_Contact_SlapChargeBuntStar][1]) {
      inMemBatter.mostPerfectContact = true;
    }
  } else if (inMemBatter.Batter_ContactType < Perfect) {
    if (inMemBatter.Batter_ContactType == LeftSour) {
      inMemBatter.ContactQuality =
        inMemBatter.CalculatedBallPos / inMemBatter.LeftNiceThreshold;
    } else {
      inMemBatter.ContactQuality =
        (inMemBatter.CalculatedBallPos - inMemBatter.LeftNiceThreshold) /
        (inMemBatter.LeftPerfectThreshold - inMemBatter.LeftNiceThreshold);
    }
  } else if (inMemBatter.Batter_ContactType < RightSour) {
    inMemBatter.ContactQuality =
      1 -
      (inMemBatter.CalculatedBallPos - inMemBatter.RightPerfectThreshold) /
      (inMemBatter.RightNiceThreshold - inMemBatter.RightPerfectThreshold);
  } else {
    inMemBatter.ContactQuality =
      1 -
      (inMemBatter.CalculatedBallPos - inMemBatter.RightNiceThreshold) /
      (200 - inMemBatter.RightNiceThreshold);
  }
  if (inMemBatter.AtBat_MoonShot != false) {
    if (inMemBatter.Batter_ContactType == Perfect) {
      inMemBatter.AtBat_Mystery_CaptainStarSwing = 0;
    } else {
      inMemBatter.AtBat_MoonShot = false;
    }
  }
  if (inMemBatter.Batter_Contact_SlapChargeBuntStar == Slap ||
    inMemBatter.Batter_Contact_SlapChargeBuntStar == Charge) {
    // Default to Sour
    inMemBatter.Batter_HitType = SourSlap;
    // Adjust if the hit was nice or perfect
    if (inMemBatter.Batter_ContactType == Perfect) {
      inMemBatter.Batter_HitType = PerfectSlap;
    } else if (inMemBatter.Batter_ContactType == LeftNice ||
      inMemBatter.Batter_ContactType == RightNice) {
      inMemBatter.Batter_HitType = NiceSlap;
    }
    // Adjust the HitType on a perfect pitch
    // 0xc for strike, 0xf for hit
    if (inMemPitcher.ChargePitchType == PitchChargeType_Perfect) {
      if (inMemBatter.Batter_Contact_SlapChargeBuntStar == Slap) {
        inMemBatter.Batter_HitType += PerfectPitchSourSlap;
      } else {
        inMemBatter.Batter_HitType += PerfectPitchSourCharge;
      }
    } else {
      // Else not perfect charge pitch
      // If the pitch was Curve and contact was not a hit, it was a charge:
      // adjust by 0x3
      if (inMemPitcher.Pitcher_TypeOfPitch == PitchCurve) {
        if (inMemBatter.Batter_Contact_SlapChargeBuntStar != Slap) {
          inMemBatter.Batter_HitType += SourCharge;
        }
      } else {
        // Else non-curve, which I believe is just a change up
        // adjust by 0x6 for Hit
        // adjust by 0x9 for Charge
        if (inMemBatter.Batter_Contact_SlapChargeBuntStar == Slap) {
          inMemBatter.Batter_HitType += SourChangeUpSlap;
        } else {
          inMemBatter.Batter_HitType += SourChangeUpCharge;
        }
      }
    }
  }
  Display_Output.Contact = [
    "Left Sour",
    "Left Nice",
    "Perfect",
    "Right Nice",
    "Right Sour",
  ][inMemBatter.Batter_ContactType];
  Display_Output.ContactQuality = inMemBatter.ContactQuality;
  Display_Output.AbsoluteContact = inMemBatter.CalculatedBallPos;
  return;
}
