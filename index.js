import { Lefty, LeftSour, LeftNice, Perfect, RightNice, RightSour, Slap, Charge, SourSlap, PerfectSlap, NiceSlap, PitchChargeType_Perfect, PerfectPitchSourSlap, PerfectPitchSourCharge, PitchCurve, SourCharge, SourChangeUpSlap, SourChangeUpCharge, PushPullNone, Righty, PullStickTowardsHitting, PushStickAway, PitchChargeType_None, PitchCharge, PitchChargeType_Charge, PitchChangeUp, Bunt, Star } from "./data/constants.js";

import { stats, BatterHitbox, noteBlocks, stadiums, BallContactArray_807b6294, UINT_ARRAY_ARRAY_807b7134, ContactPerfectThresholds, contact_ChemLinkMultipliers, BattingAngleRanges, BattingVerticalAngleWeights, SHORT_ARRAY_ARRAY_ARRAY_ARRAY_807b67cc, BallHitArray, StarSwingExitVelocityArray, FLOAT_ARRAY_ARRAY_807b7480, FieldTrajectories, NonCaptainStarSwingBattingVerticalAngleRanges, CaptainStarSwingBattingVerticalAngleRanges, SHORT_ARRAY_ARRAY_807b6af4, CaptainStarSwingExitVelocityArray, RandomBattingFactors_ChemLinkMult0, BattingExtensions, FLOAT_ARRAY_ARRAY_807b72bc } from "./data/constants.js";

import { isEmptyOrSpaces } from "./helpers/helpers.js";

import { valueToDegrees, degreeToPoint, degreesToRadians, average, anglesToArc, floor, linearInterpolateToNewRange, adjustAngle, mssbConvertToRadians } from "./helpers/math/helpers.js";

var StaticRandomInt1 = 7769; // <= 32767
var StaticRandomInt2 = 5359; // <= 32767
var USHORT_8089269c = 1828; // <= 32767

var inMemBatter = undefined;
var inMemPitcher = undefined;
var inMemBall = undefined;
var Hit_HorizontalAngle = [];
var Hit_VerticalAngle = [];
var Hit_HorizontalPower = [];
var AddedContactGravity = 0;
var Display_Output = {};
var homeRunInd = [[0], [0], [0], [0], [0], [0], [0]];
var hRSum = 0;
var outfieldWallDist = [];
var outfieldWallHeight = [[0], [0], [0], [0], [0], [0], [0]];
var hitToDraw = [];
var numSims = 1;
var ChosenStadium = 0;
var randomType = 1;
var randomCounter1 = 0;
var randomCounter2 = 0;
var randomCounter3 = 0;
var dotColour = "#000000";
var plotMode = "compareSims"; // singleSim, singlePoint, compareSims, varyInputs
var CalculatedPoints = [];
var CalculatedPointsPrev = [];
var runNum = 0;
var batterStarsOnIncrease = 0;
var pitcherStarsOnIncrease = 0;
var isLefty = 0;

var ballXRandom = undefined;
var ballXLower = 0;
var ballXUpper = 0;

let randomContactHRFinished = 0;
let randHrPercent = [];

let frameUpper = 0;
let frameLower = 0;

var hitNoteBlockInd = [];

const batterPosX = document.getElementById("batterX2");
const posXOutput = document.getElementById("posXOutput");

let charSelectListener = document.getElementById("batterID");
if (charSelectListener) {
  charSelectListener.addEventListener("change", () => {
    // posXOutput.value = 0;
    batterPosX.min = BatterHitbox[charSelectListener.value].HorizontalRangeNear;
    batterPosX.max = BatterHitbox[charSelectListener.value].HorizontalRangeFar;
    batterPosX.step = 0.01;
    batterPosX.value = 0; //
  });

  batterPosX.addEventListener("input", () => {
    const posXValue = parseFloat(batterPosX.value);
    posXOutput.value = posXValue.toFixed(2);
  });
} else {
  console.log("Element with ID 'batterID' not found.");
}


function individualCalcContactThresholds(
  charID,
  slapChargeStarBunt,
  chem,
  captain,
  easyBatting
) {
  let id = charID;
  let trimmedBat = BatterHitbox[id].TrimmedBat == 1.0 ? 1 : 0;
  let chargeUp = slapChargeStarBunt == 1 ? 0.5 : 0.0;
  let contactSize = inMemBatter.Batter_SlapContactSize;

  if (captain && slapChargeStarBunt == 2) {
    // if there was a star swing, make contact size 100
    chargeUp = 0.0;
    contactSize = 100.0;
  }

  if (slapChargeStarBunt == 3) {
    if (chargeUp <= 0.0) {
      // If not charging
      if (chem != 0) {
        // If there are chem links on base, make the contact size larger
        contactSize *= contact_ChemLinkMultipliers[chem];
      }
    } else {
      // else there is a charge
      contactSize = inMemBatter.Batter_ChargeContactSize;
    }
  } else {
    // else bunting, use bunting contact size
    contactSize = stats[id]["Bunting"];
  }

  // Higher is better, makes ranges larger
  contactSize = contactSize / 100.0;
  // Contact sizes are only based on slap/charge and trimming, and easy batting
  let big_Array =
    BallContactArray_807b6294[trimmedBat][slapChargeStarBunt][easyBatting];
  let b0 = big_Array[0];
  let b1 = big_Array[1];
  let b2 = big_Array[2];
  let b3 = big_Array[3];
  console.log(big_Array)
  return {
    LeftNiceThreshold: contactSize * (big_Array[4] - b0) + b0,
    LeftPerfectThreshold: contactSize * (big_Array[5] - b1) + b1,
    RightPerfectThreshold: contactSize * (big_Array[6] - b2) + b2,
    RightNiceThreshold: contactSize * (big_Array[7] - b3) + b3,
  };
}

function calculateContact() {
  let chargeUp = inMemBatter.BatterAtPlate_BatterCharge_Up;
  let contactSize = inMemBatter.Batter_SlapContactSize;
  if (inMemBatter.AtBat_Mystery_CaptainStarSwing != 0) {
    // if there was a star swing, make contact size 100
    chargeUp = 0.0;
    contactSize = 100.0;
  }
  if (inMemBatter.Batter_IsBunting == false) {
    if (chargeUp <= 0.0) {
      // If not charging
      if (inMemBatter.RandomBattingFactors_ChemLinksOnBase != 0) {
        // If there are chem links on base, make the contact size larger
        contactSize *=
          contact_ChemLinkMultipliers[
          inMemBatter.RandomBattingFactors_ChemLinksOnBase
          ];
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

  if (diffInX >= 0.0) {
    inMemBatter.CalculatedBallPos =
      100.0 *
      (diffInX / BatterHitbox[inMemBatter.Batter_CharID].HorizontalRangeFar) +
      100.0;
  } else {
    inMemBatter.CalculatedBallPos = -(
      100.0 *
      (diffInX /
        BatterHitbox[inMemBatter.Batter_CharID].HorizontalRangeNear) -
      100.0
    );
  }

  if (inMemBatter.CalculatedBallPos < 0.0) {
    inMemBatter.CalculatedBallPos = 0.0;
  }
  if (200.0 < inMemBatter.CalculatedBallPos) {
    inMemBatter.CalculatedBallPos = 200.0;
  }

  Display_Output["Contact Point"] = inMemBatter.CalculatedBallPos;

  // Higher is better, makes ranges larger
  contactSize = contactSize / 100.0;
  // Contact sizes are only based on slap/charge and trimming, and AI
  let big_Array =
    BallContactArray_807b6294[inMemBatter.AtBat_TrimmedBat][
    inMemBatter.Batter_Contact_SlapChargeBuntStar
    ][inMemBatter.EasyBatting];
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
    if (inMemBatter.CalculatedBallPos >= 100.0) {
      inMemBatter.ContactQuality =
        1.0 -
        (inMemBatter.CalculatedBallPos - inMemBatter.LeftPerfectThreshold) /
        (inMemBatter.RightPerfectThreshold -
          inMemBatter.LeftPerfectThreshold);
    } else {
      inMemBatter.ContactQuality =
        (inMemBatter.CalculatedBallPos - inMemBatter.LeftPerfectThreshold) /
        (inMemBatter.RightPerfectThreshold - inMemBatter.LeftPerfectThreshold);
    }
    if (
      ContactPerfectThresholds[
      inMemBatter.Batter_Contact_SlapChargeBuntStar
      ][0] <= inMemBatter.CalculatedBallPos &&
      inMemBatter.CalculatedBallPos <=
      ContactPerfectThresholds[
      inMemBatter.Batter_Contact_SlapChargeBuntStar
      ][1]
    ) {
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
      1.0 -
      (inMemBatter.CalculatedBallPos - inMemBatter.RightPerfectThreshold) /
      (inMemBatter.RightNiceThreshold - inMemBatter.RightPerfectThreshold);
  } else {
    inMemBatter.ContactQuality =
      1.0 -
      (inMemBatter.CalculatedBallPos - inMemBatter.RightNiceThreshold) /
      (200.0 - inMemBatter.RightNiceThreshold);
  }
  if (inMemBatter.AtBat_MoonShot != false) {
    if (inMemBatter.Batter_ContactType == Perfect) {
      inMemBatter.AtBat_Mystery_CaptainStarSwing = 0;
    } else {
      inMemBatter.AtBat_MoonShot = false;
    }
  }
  if (
    inMemBatter.Batter_Contact_SlapChargeBuntStar == Slap ||
    inMemBatter.Batter_Contact_SlapChargeBuntStar == Charge
  ) {
    // Default to Sour
    inMemBatter.Batter_HitType = SourSlap;
    // Adjust if the hit was nice or perfect
    if (inMemBatter.Batter_ContactType == Perfect) {
      inMemBatter.Batter_HitType = PerfectSlap;
    } else if (
      inMemBatter.Batter_ContactType == LeftNice ||
      inMemBatter.Batter_ContactType == RightNice
    ) {
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


function WeightedRandomIndex(vals, count) {
  let randomSum = 0;

  let loopSum = 0;

  vals.forEach((element) => {
    loopSum += element;
  });

  let finSum = loopSum;

  if (loopSum < 0) {
    finSum = -loopSum;
  }

  if (finSum < 2) {
    randomSum = 0;
  } else {
    // update RandomInt in case it's called successive times
    StaticRandomInt1 =
      StaticRandomInt1 -
      (StaticRandomInt2 & 0xff) +
      floor(StaticRandomInt2 / finSum) +
      USHORT_8089269c;
    let randomRange = StaticRandomInt1 - floor(StaticRandomInt1 / finSum) * finSum;
    randomSum = ((randomRange >> 0x1f) ^ randomRange) - (randomRange >> 0x1f);
    if (loopSum < 0) {
      randomSum = -randomSum;
    }
  }
  let p_loopArray = vals;
  let newIndex = 0;
  let i = 0;
  if (0 < count) {
    do {
      if (randomSum < p_loopArray[i]) {
        return newIndex;
      }
      randomSum -= p_loopArray[i];
      newIndex += 1;
      count += -1;
      i++;
    } while (count != 0);
  }
  return 0;
}

function calculateHorizontalAngle(j) {
  let input = inMemBatter.ControllerInput;

  let isCharge = inMemBatter.Batter_Contact_SlapChargeBuntStar != Slap ? 1 : 0;
  inMemBatter.AtBat_InputDirection = PushPullNone;
  if (inMemBatter.AtBat_Mystery_BatDirection == 0) {
    if (!input.Right) {
      if (input.Left) {
        if (inMemBatter.AtBat_BatterHand == Righty) {
          inMemBatter.AtBat_InputDirection = PullStickTowardsHitting;
        } else {
          inMemBatter.AtBat_InputDirection = PushStickAway;
        }
      }
    } else if (inMemBatter.AtBat_BatterHand == Righty) {
      inMemBatter.AtBat_InputDirection = PushStickAway;
    } else {
      inMemBatter.AtBat_InputDirection = PullStickTowardsHitting;
    }
  }

  let inputDirection = inMemBatter.AtBat_InputDirection;
  let frameOfContact = inMemBatter.Frame_SwingContact1;
  let iVar2 = BattingAngleRanges[inputDirection][isCharge][frameOfContact][0];
  let iVar1 = BattingAngleRanges[inputDirection][isCharge][frameOfContact][1];

  Display_Output["Horizontal Range"] = [
    BattingAngleRanges[inputDirection][isCharge][frameOfContact][0] + 0x400,
    BattingAngleRanges[inputDirection][isCharge][frameOfContact][1] + 0x400,
  ];

  iVar1 -= iVar2;
  if (iVar1 < 0) {
    iVar2 += StaticRandomInt1 - floor(StaticRandomInt1 / -iVar1) * -iVar1;
  } else if (0 < iVar1) {
    iVar2 += StaticRandomInt1 - floor(StaticRandomInt1 / iVar1) * iVar1;
  }
  iVar2 += 0x400;
  if (inMemBatter.AtBat_BatterHand != Righty) {
    if (iVar2 < 0x801) {
      iVar2 = 0x800 - iVar2;
    } else {
      iVar2 = 0x1800 - iVar2;
    }
  }
  Hit_HorizontalAngle[j] = adjustAngle(iVar2);
}

function calculateVerticalAngle(j) {
  let iVar5 = 0;
  let upDown = 0;
  let slapOrCharge = inMemBatter.Batter_Contact_SlapChargeBuntStar != 0 ? 1 : 0;
  let pInput = inMemBatter.ControllerInput;
  let lowerRange;
  let higherRange;
  let handledVerticalZones = false;

  let captainStarSwing = inMemBatter.AtBat_Mystery_CaptainStarSwing;
  if (captainStarSwing == 0) {
    if (inMemBatter.AtBat_MoonShot == false) {
      let noncaptainStarSwing = inMemBatter.nonCaptainStarSwingContact;
      if (noncaptainStarSwing == 0) {
        if (inMemBatter.AtBat_Mystery_BatDirection == 0) {
          if (!pInput.Up) {
            if (pInput.Down) {
              // 2 == Down
              upDown = 2;
            }
          } else {
            // 1 == Up
            upDown = 1;
          }
        }

        let pabVar4 =
          BattingVerticalAngleWeights[inMemBatter.AtBat_HitTrajectoryLow][
          slapOrCharge
          ][inMemBatter.EasyBatting][inMemBatter.Batter_ContactType];
        let local_28 = pabVar4[0];
        let local_27 = pabVar4[1];
        let local_26 = pabVar4[2];
        let local_25 = pabVar4[3];
        let local_24 = pabVar4[4];

        let uVar4 =
          UINT_ARRAY_ARRAY_807b7134[inMemBatter.Batter_HitType][
          3 - inMemBatter.EasyBatting
          ];
        let uVar6 = UINT_ARRAY_ARRAY_807b7134[inMemBatter.Batter_HitType][4];
        let uVar5 = uVar4 & 0xf000000;
        if (uVar5 == 0) {
          let uVar16 = uVar4 & 0xf;
          if (uVar16 != 0) {
            iVar5 = 2;
            if (uVar16 == 2) {
              if (upDown == 2) {
                iVar5 = 0;
                uVar6 = 2;
              }
            } else if (uVar16 == 3 && upDown == 1) {
              iVar5 = 0;
              uVar6 = 2;
            }
          }
        } else {
          iVar5 = 1;
          if (uVar5 == 0x2000000) {
            if (upDown == 2) {
              iVar5 = 0;
              uVar6 = 2;
            }
          } else if (uVar5 == 0x3000000 && upDown == 1) {
            iVar5 = 0;
            uVar6 = 2;
          }
        }

        if (uVar6 == 1) {
          var DAT_80893800_VertAngle = 2;
        } else if (uVar6 == 2) {
          var DAT_80893800_VertAngle = 3;
        }

        if (iVar5 == 0) {
          if ((uVar4 & 0x1e0) == 0) {
            local_28 = 0;
          }
          if ((uVar4 & 0xf0) == 0) {
            local_27 = 0;
          }
          if ((uVar4 & 0x78) == 0) {
            local_26 = 0;
          }
          if ((uVar4 & 0x3c) == 0) {
            local_25 = 0;
          }
          if ((uVar4 & 0x1e) == 0) {
            local_24 = 0;
          }
          if (upDown == 2) {
            local_24 += local_28;
            local_28 = 0;
          } else if (upDown == 1) {
            let cVar2 = local_24 + local_28;
            local_24 = 0;
            local_28 = local_25 + cVar2;
            local_25 = 0;
          }
        }

        if (iVar5 == 0) {
          let weightedRandomIndex = WeightedRandomIndex(
            [local_28, local_27, local_26, local_25, local_24],
            5
          );

          // Regular star swings
          lowerRange =
            SHORT_ARRAY_ARRAY_ARRAY_ARRAY_807b67cc[slapOrCharge][
            inMemBatter.Batter_ContactType
            ][weightedRandomIndex][0];
          higherRange =
            SHORT_ARRAY_ARRAY_ARRAY_ARRAY_807b67cc[slapOrCharge][
            inMemBatter.Batter_ContactType
            ][weightedRandomIndex][1];

          Display_Output["Vertical Zones"] =
            SHORT_ARRAY_ARRAY_ARRAY_ARRAY_807b67cc[slapOrCharge][
            inMemBatter.Batter_ContactType
            ];
          Display_Output["Vertical Zone Chances"] = [
            local_28,
            local_27,
            local_26,
            local_25,
            local_24,
          ];
          Display_Output["Selected Vertical Zone"] = weightedRandomIndex;
          handledVerticalZones = true;
        } else {
          lowerRange = SHORT_ARRAY_ARRAY_807b6af4[iVar5][0];
          higherRange = SHORT_ARRAY_ARRAY_807b6af4[iVar5][1];
        }
      } else {
        // Non Captain Star Swings
        lowerRange =
          NonCaptainStarSwingBattingVerticalAngleRanges[
          noncaptainStarSwing - 1
          ][inMemBatter.Batter_ContactType][0];
        higherRange =
          NonCaptainStarSwingBattingVerticalAngleRanges[
          noncaptainStarSwing - 1
          ][inMemBatter.Batter_ContactType][1];
      }
    } else {
      // Moonshot, also uses Charge Angles
      lowerRange =
        SHORT_ARRAY_ARRAY_ARRAY_ARRAY_807b67cc[1][
        inMemBatter.Batter_ContactType
        ][2][0];
      higherRange =
        SHORT_ARRAY_ARRAY_ARRAY_ARRAY_807b67cc[1][
        inMemBatter.Batter_ContactType
        ][2][1];
    }
  } else {
    // Captain Star Swings
    lowerRange =
      CaptainStarSwingBattingVerticalAngleRanges[captainStarSwing - 1][
      inMemBatter.Batter_ContactType
      ][0];
    higherRange =
      CaptainStarSwingBattingVerticalAngleRanges[captainStarSwing - 1][
      inMemBatter.Batter_ContactType
      ][1];
  }

  if (!handledVerticalZones) {
    Display_Output["Vertical Zones"] = [[lowerRange, higherRange]];
    Display_Output["Vertical Zone Chances"] = [100];
    Display_Output["Selected Vertical Zone"] = 0;
  }

  Display_Output["Vertical Range"] = [lowerRange, higherRange];

  let sVar3 =
    lowerRange +
    (StaticRandomInt1 -
      floor(StaticRandomInt1 / (higherRange - lowerRange)) *
      (higherRange - lowerRange));

  Hit_VerticalAngle[j] = sVar3;

  if (Hit_VerticalAngle[j] < 0x401) {
    if (Hit_VerticalAngle[j] < -0x400) {
      Hit_VerticalAngle[j] += 0x1000;
      Hit_HorizontalAngle[j] = adjustAngle(Hit_HorizontalAngle[j] + 0x800);
    } else if (Hit_VerticalAngle[j] < 0) {
      Hit_VerticalAngle[j] += 0x1000;
    }
  } else {
    Hit_VerticalAngle[j] = 0x800 - Hit_VerticalAngle[j];
    Hit_HorizontalAngle[j] = adjustAngle(Hit_HorizontalAngle[j] + 0x800);
  }
}

function calculateHitPower(j) {
  let uVar2 = 0;
  let niceSour = inMemBatter.Batter_ContactType;
  let charged = inMemBatter.BatterAtPlate_BatterCharge_Up;
  let power;
  let perfectNiceSour;
  let ballAngle;
  let iVar1;
  // Regular contact array
  let contactArray =
    BallHitArray[inMemBatter.Batter_Contact_SlapChargeBuntStar][niceSour];

  if (inMemBatter.AtBat_Mystery_CaptainStarSwing == 0) {
    if (inMemBatter.nonCaptainStarSwingContact != 0) {
      charged = 0.0;
      // NonCaptainStarSwing array
      contactArray =
        StarSwingExitVelocityArray[inMemBatter.nonCaptainStarSwingContact - 1][
        niceSour
        ];
    }
  } else {
    charged = 0.0;
    // CaptainStarSwingArray
    contactArray =
      CaptainStarSwingExitVelocityArray[
      inMemBatter.AtBat_Mystery_CaptainStarSwing - 1
      ][niceSour];
  }

  if (inMemBatter.AtBat_Mystery_DidPopFlyOrGrounderConnect != false) {
    inMemBatter.BatterAtPlate_BatterCharge_Down = 1.0;
  }

  if (inMemBatter.AtBat_MoonShot) {
    // Moonshot array
    contactArray = BallHitArray[1][inMemBatter.Batter_ContactType];
  }

  // Low value
  let arrayV1 = contactArray[0];
  // High Value
  let arrayV2 = contactArray[1];
  // 0x44 is a range 0-1 towards the better contact
  let calcedDistance = inMemBatter.ContactQuality * (arrayV2 - arrayV1) + arrayV1;
  // Non star swing
  if (inMemBatter.AtBat_Mystery_CaptainStarSwing == 0) {
    if (charged <= 0.0) {
      // If not charged, use slap hit power
      power = inMemBatter.Batter_SlapHitPower;
    } else {
      // use charge power
      power =
        inMemBatter.BatterAtPlate_ChargePower -
        (inMemBatter.BatterAtPlate_ChargePower -
          inMemBatter.Batter_SlapHitPower) *
        0.5 *
        (1.0 - inMemBatter.BatterAtPlate_BatterCharge_Down);
    }
  } else {
    // if star swing, power is always 100
    power = 100.0;
  }
  if (
    inMemBatter.AtBat_Mystery_CaptainStarSwing == 0 &&
    inMemBatter.nonCaptainStarSwingContact == 0
  ) {
    perfectNiceSour = 2;
    if (
      inMemBatter.Batter_ContactType == LeftNice ||
      inMemBatter.Batter_ContactType == RightNice
    ) {
      perfectNiceSour = 1;
    } else if (inMemBatter.Batter_ContactType == Perfect) {
      perfectNiceSour = 0;
    }
    let dVar3 = linearInterpolateToNewRange(
      inMemPitcher.calced_cursedBall,
      0.0,
      100.0,
      FLOAT_ARRAY_ARRAY_807b7480[perfectNiceSour][0],
      FLOAT_ARRAY_ARRAY_807b7480[perfectNiceSour][1]
    );
    power = power * dVar3;
  }
  if (inMemBatter.RandomBattingFactors_ChemLinksOnBase != 0 && 0.0 < charged) {
    // If charging, add a multiplier for chem on base
    power =
      power *
      RandomBattingFactors_ChemLinkMult0[
      inMemBatter.RandomBattingFactors_ChemLinksOnBase
      ];
  }
  if (-1 < inMemBatter.Batter_HitType) {
    power =
      (power *
        UINT_ARRAY_ARRAY_807b7134[inMemBatter.Batter_HitType][
        1 - inMemBatter.EasyBatting
        ]) /
      100.0;
  }
  let fVar1 = calcedDistance * ((power / 100.0) * (1.0 - 0.8) + 0.8);

  AddedContactGravity = 0.00001 * contactArray[2];
  if (inMemBatter.AtBat_Mystery_CaptainStarSwing == 0) {
    ballAngle = Hit_HorizontalAngle[j];
    if (ballAngle < 0x200) {
      niceSour = 0;
    } else if (ballAngle < 0x601) {
      niceSour = ballAngle - 0x200;
    } else {
      niceSour = 0x400;
    }
    if (inMemBatter.AtBat_BatterHand != Righty) {
      niceSour = 0x400 - niceSour;
    }
    if (niceSour < 0x100) {
      iVar1 = 0;
    } else if (niceSour < 0x200) {
      iVar1 = 1;
      niceSour -= 0x100;
    } else if (niceSour < 0x300) {
      iVar1 = 2;
      niceSour -= 0x200;
    } else {
      iVar1 = 3;
      niceSour -= 0x300;
    }
    let fieldAreaBonus = linearInterpolateToNewRange(
      niceSour / 256,
      0.0,
      1.0,
      FieldTrajectories[inMemBatter.BatterAtPlate_TrajectoryNearFar][iVar1],
      FieldTrajectories[inMemBatter.BatterAtPlate_TrajectoryNearFar][iVar1 + 1]
    );
    fVar1 = fVar1 * fieldAreaBonus;
  }

  if (inMemBatter.AtBat_MoonShot) {
    fVar1 = fVar1 * AtBat_MoonShotMultiplier;
  }

  Hit_HorizontalPower[j] = floor(fVar1);
  return;
}

var readValues = undefined;

function randomInputs() {
  function randIndex(box) {
    box.selectedIndex = floor(Math.random() * box.options.length);
  }

  function randRange(box, min, max, fixedpoint = -1) {
    let range = max - min;
    let value = Math.random() * range + min;
    if (fixedpoint >= 0) {
      value = value.toFixed(fixedpoint);
    }
    box.value = value;
  }

  randIndex(document.getElementById("pitcherID"));
  randIndex(document.getElementById("pitchType"));
  randIndex(document.getElementById("batterID"));

  let batter_id = document.getElementById("batterID").value;

  randRange(
    document.getElementById("ballX"),
    BattingExtensions[BatterHitbox[batter_id].TrimmedBat][0],
    BattingExtensions[BatterHitbox[batter_id].TrimmedBat][1],
    4
  );
  document.getElementById("batterX").value = 0;
  randIndex(document.getElementById("handedness"));
  randIndex(document.getElementById("chemOnBase"));
  randIndex(document.getElementById("slapChargeStarBunt"));

  if (document.getElementById("slapChargeStarBunt").value < 1) {
    randIndex(document.getElementById("frameOfContact"));
  } else {
    document.getElementById("frameOfContact").selectedIndex =
      Math.random() *
      (document.getElementById("frameOfContact").options.length - 1) +
      1;
    let rand = Math.random() * 3.1;
    if (rand < 1) {
      randRange(document.getElementById("chargeUp"), 0, 0);
      randRange(document.getElementById("chargeDown"), 0, 0);
    } else if (rand < 2) {
      randRange(document.getElementById("chargeUp"), 0, 1, 3);
      randRange(document.getElementById("chargeDown"), 0, 0);
    } else if (rand < 3) {
      randRange(document.getElementById("chargeUp"), 1, 1);
      randRange(document.getElementById("chargeDown"), 0, 1, 3);
    } else {
      randRange(document.getElementById("chargeUp"), 1, 1);
      randRange(document.getElementById("chargeDown"), 1, 1);
    }
  }

  randRange(document.getElementById("randomInt1"), 0, 2 ** 15 - 1, 0);
  randRange(document.getElementById("randomInt2"), 0, 2 ** 15 - 1, 0);
  randRange(document.getElementById("randomCounter"), 0, 2 ** 15 - 1, 0);

  let r1 = Math.random() * 3;
  let r2 = Math.random() * 3;
  document.getElementById("inputUp").checked = r1 <= 1;
  document.getElementById("inputDown").checked = r1 >= 2;
  document.getElementById("inputLeft").checked = r2 <= 1;
  document.getElementById("inputRight").checked = r2 >= 2;
}

function parseInputs() {
  readValues = {};
  let pitcher_id
  readValues.pitcher_id = pitcher_id =
    document.getElementById("pitcherID").value;
  readValues.pitcherChargeVal = document.getElementById("pitchType").value;
  readValues.pitcherStarsOn =
    document.getElementById("pitcherSuperstar").checked;

  if (!isEmptyOrSpaces(document.getElementById("randomInt1").value)) {
    readValues.StaticRandomInt1 = parseInt(
      document.getElementById("randomInt1").value
    );
  }

  if (!isEmptyOrSpaces(document.getElementById("randomInt2").value)) {
    readValues.StaticRandomInt2 = parseInt(
      document.getElementById("randomInt2").value
    );
  }

  if (!isEmptyOrSpaces(document.getElementById("randomCounter").value)) {
    readValues.USHORT_8089269c = parseInt(
      document.getElementById("randomCounter").value
    );
  }

  readValues.batter_id = document.getElementById("batterID").value;
  readValues.batterStarsOn = document.getElementById("batterSuperstar").checked;

  readValues.posX = parseFloat(document.getElementById("batterX").value);
  readValues.ballContact_X = parseFloat(document.getElementById("ballX").value);

  if (!isEmptyOrSpaces(document.getElementById("ballXMin").value)) {
    readValues.ballContact_X_Lower = parseFloat(
      document.getElementById("ballXMin").value
    );
  }

  if (!isEmptyOrSpaces(document.getElementById("ballXMax").value)) {
    readValues.ballContact_X_Upper = parseFloat(
      document.getElementById("ballXMax").value
    );
  }

  readValues.AtBat_BatterHand = document.getElementById("handedness").value;

  readValues.Batter_Contact_SlapChargeBuntStar =
    document.getElementById("slapChargeStarBunt").value;

  readValues.Up = document.getElementById("inputUp").checked;
  readValues.Down = document.getElementById("inputDown").checked;
  readValues.Left = document.getElementById("inputLeft").checked;
  readValues.Right = document.getElementById("inputRight").checked;

  readValues.chargeUp = parseFloat(document.getElementById("chargeUp").value);
  readValues.chargeDown = parseFloat(
    document.getElementById("chargeDown").value
  );

  readValues.RandomBattingFactors_ChemLinksOnBase =
    document.getElementById("chemOnBase").value;

  readValues.frameOfContact = document.getElementById("frameOfContact").value;
  readValues.frameRange = parseInt(
    document.getElementById("contactFrameRange").value
  );

  readValues.EasyBatting = document.getElementById("isEasyBatting").checked
    ? 1
    : 0;

  readValues.isStar = document.getElementById("isStar").checked ? 1 : 0;

  readValues.stadiumID = document.getElementById("stadiumID").value;

  readValues.showNoteBlocks = document.getElementById("showNoteBlocks").checked;
  readValues.invisToNotePercent =
    parseFloat(document.getElementById("invisToNotePercent").value) / 100;

  readValues.simulations = parseFloat(
    document.getElementById("numberOfSims").value
  );

  readValues.simulationType = document.getElementById("simulationType").value;

  //Override values
  readValues.oRSlapContactSize = parseInt(
    document.getElementById("slapContactSize").value
  );
  readValues.oRChargeContactSize = parseInt(
    document.getElementById("chargeContactSize").value
  );
  readValues.oRSlapPower = parseInt(
    document.getElementById("slapPowerOverride").value
  );
  readValues.oRChargePower = parseInt(
    document.getElementById("chargePowerOverride").value
  );
  readValues.oRHTraj = parseInt(document.getElementById("horizHitTraj").value);
  readValues.oRVTraj = parseInt(document.getElementById("vertHitTraj").value);
  readValues.oRSuperCurve = parseInt(
    document.getElementById("superCurve").value
  );
}

function parseValues() {
  Display_Output = {};
  inMemBall = {};
  inMemPitcher = {};

  //batterStarsOn = true;
  //pitcherStarsOn = true;
  //set stars on buffs
  if (readValues.batterStarsOn) {
    batterStarsOnIncrease = 50;
  } else {
    batterStarsOnIncrease = 0;
  }

  if (readValues.pitcherStarsOn) {
    pitcherStarsOnIncrease = 50;
  } else {
    pitcherStarsOnIncrease = 0;
  }

  inMemPitcher.calced_cursedBall =
    stats[readValues.pitcher_id]["Cursed Ball"] + pitcherStarsOnIncrease;
  let pitcherChargeVal = readValues.pitcherChargeVal;
  if (pitcherChargeVal == 0) {
    inMemPitcher.Pitcher_TypeOfPitch = PitchCurve;
    inMemPitcher.ChargePitchType = PitchChargeType_None;
  } else if (pitcherChargeVal == 1) {
    inMemPitcher.Pitcher_TypeOfPitch = PitchCharge;
    inMemPitcher.ChargePitchType = PitchChargeType_Charge;
  } else if (pitcherChargeVal == 2) {
    inMemPitcher.Pitcher_TypeOfPitch = PitchCharge;
    inMemPitcher.ChargePitchType = PitchChargeType_Perfect;
  } else if (pitcherChargeVal == 3) {
    inMemPitcher.Pitcher_TypeOfPitch = PitchChangeUp;
    inMemPitcher.ChargePitchType = PitchChargeType_None;
  }

  StaticRandomInt1 = undefined;
  StaticRandomInt2 = undefined;
  USHORT_8089269c = undefined;

  if (readValues.StaticRandomInt1 != undefined) {
    StaticRandomInt1 = readValues.StaticRandomInt1;
  } else {
    StaticRandomInt1 = floor(Math.random() * 2 ** 15 - 1);
  }

  if (readValues.StaticRandomInt2 != undefined) {
    StaticRandomInt2 = readValues.StaticRandomInt2;
  } else {
    StaticRandomInt2 = floor(Math.random() * 2 ** 15 - 1);
  }

  if (readValues.USHORT_8089269c != undefined) {
    USHORT_8089269c = readValues.USHORT_8089269c;
  } else {
    USHORT_8089269c = floor(Math.random() * 2 ** 15 - 1);
  }

  ChosenStadium = parseInt(readValues.stadiumID);
  numSims = readValues.simulations;
  randomType = parseInt(readValues.simulationType);

  inMemBatter = {};
  let id = readValues.batter_id;

  inMemBatter.Batter_CharID = id;
  inMemBatter.Name = stats[id].Name;
  inMemBatter.AtBat_Mystery_BatDirection = 0;
  inMemBatter.AtBat_TrimmedBat = BatterHitbox[id]["TrimmedBat"] == 0.0 ? 0 : 1;

  inMemBatter.posX = readValues.posX;
  inMemBatter.ballContact_X = readValues.ballContact_X;

  if (
    readValues.ballContact_X_Lower != undefined &&
    readValues.ballContact_X_Upper != undefined
  ) {
    if (
      readValues.ballContact_X_Lower < readValues.ballContact_X &&
      readValues.ballContact_X < readValues.ballContact_X_Upper
    ) {
      ballXLower = readValues.ballContact_X_Lower;
      ballXUpper = readValues.ballContact_X_Upper;
      ballXRandom = true;
    } else {
      alert(
        "Ensure the ball contact x lower bound is less than the real value, and that the upper bound is greater than the real value"
      );
      return;
    }
  } else {
    ballXLower = readValues.ballContact_X;
    ballXUpper = readValues.ballContact_X;
    ballXRandom = false;
  }

  inMemBatter.AtBat_BatterHand = readValues.AtBat_BatterHand;

  inMemBatter.Batter_Contact_SlapChargeBuntStar =
    readValues.Batter_Contact_SlapChargeBuntStar;
  inMemBatter.Batter_IsBunting =
    inMemBatter.Batter_Contact_SlapChargeBuntStar == Bunt;

  inMemBatter.BatterAtPlate_BatterCharge_Up = readValues.chargeUp;
  inMemBatter.BatterAtPlate_BatterCharge_Down = readValues.chargeDown;
  inMemBatter.AtBat_IsFullyCharged =
    inMemBatter.BatterAtPlate_BatterCharge_Up == 1.0;

  if (isNaN(readValues.oRSlapPower)) {
    inMemBatter.Batter_SlapHitPower =
      stats[id]["Slap Hit Power"] + batterStarsOnIncrease;
  } else {
    inMemBatter.Batter_SlapHitPower = readValues.oRSlapPower;
  }

  if (isNaN(readValues.oRChargePower)) {
    inMemBatter.BatterAtPlate_ChargePower =
      stats[id]["Charge Hit Power"] + batterStarsOnIncrease;
  } else {
    inMemBatter.BatterAtPlate_ChargePower = readValues.oRChargePower;
  }

  if (isNaN(readValues.oRSlapContactSize)) {
    inMemBatter.Batter_SlapContactSize = stats[id]["Slap Contact Spot Size"];
  } else {
    inMemBatter.Batter_SlapContactSize = readValues.oRSlapContactSize;
  }

  if (isNaN(readValues.oRChargeContactSize)) {
    inMemBatter.Batter_ChargeContactSize =
      stats[id]["Charge Contact Spot Size"];
  } else {
    inMemBatter.Batter_ChargeContactSize = readValues.oRChargeContactSize;
  }

  //inMemBatter.Batter_SlapContactSize = stats[id]["Slap Contact Spot Size"];
  //inMemBatter.Batter_ChargeContactSize = stats[id]["Charge Contact Spot Size"];
  inMemBatter.Batter_Bunting = stats[id]["Bunting"];
  //marker
  if (readValues.oRHTraj == -1) {
    inMemBatter.BatterAtPlate_TrajectoryNearFar =
      stats[id]["Horizontal Hit Trajectory"];
  } else {
    inMemBatter.BatterAtPlate_TrajectoryNearFar = readValues.oRHTraj;
  }

  if (readValues.oRVTraj == -1) {
    inMemBatter.AtBat_HitTrajectoryLow = stats[id]["Vertical Hit Trajectory"];
  } else {
    inMemBatter.AtBat_HitTrajectoryLow = readValues.oRVTraj;
  }

  //inMemBatter.BatterAtPlate_TrajectoryNearFar = stats[id]["Horizontal Hit Trajectory"];
  //inMemBatter.AtBat_HitTrajectoryLow = stats[id]["Vertical Hit Trajectory"];

  inMemBatter.RandomBattingFactors_ChemLinksOnBase =
    readValues.RandomBattingFactors_ChemLinksOnBase;
  inMemBatter.Frame_SwingContact1 = readValues.frameOfContact;
  if (readValues.frameRange == 0) {
    frameUpper = parseInt(readValues.frameOfContact);
    frameLower = parseInt(readValues.frameOfContact);
  } else {
    frameUpper = Math.min(
      parseInt(readValues.frameOfContact) + readValues.frameRange,
      10
    );
    frameLower = Math.max(
      parseInt(readValues.frameOfContact) - readValues.frameRange,
      2
    );
  }

  inMemBatter.EasyBatting = readValues.EasyBatting;
  inMemBatter.isStar = readValues.isStar;

  inMemBatter.AtBat_MoonShot = false;

  inMemBatter.ControllerInput = {
    Up: readValues.Up,
    Down: readValues.Down,
    Left: readValues.Left,
    Right: readValues.Right,
  };
  //marker
  inMemBatter.AtBat_CaptainStarHitPitch = stats[id]["Captain Star Hit/Pitch"];
  inMemBatter.AtBat_NonCaptainStarSwing = stats[id]["Non Captain Star Swing"];

  inMemBatter.nonCaptainStarSwingContact = 0;
  inMemBatter.nonCaptainStarSwingContact = 0;
  inMemBatter.AtBat_Mystery_CaptainStarSwing = 0;
  inMemBatter.AtBat_Mystery_DidPopFlyOrGrounderConnect = false;

  let starsForBatter = 4;
  if (inMemBatter.isStar) {
    if (inMemBatter.Batter_IsBunting == false) {
      if (starsForBatter != 0) {
        if (inMemBatter.AtBat_IsFullyCharged == false || starsForBatter < 5) {
          if (inMemBatter.AtBat_CaptainStarHitPitch == 0) {
            if (
              starsForBatter < 1 ||
              inMemBatter.AtBat_NonCaptainStarSwing == 0
            ) {
              inMemBatter.isStar = false;
            } else {
              inMemBatter.nonCaptainStarSwingContact =
                inMemBatter.AtBat_NonCaptainStarSwing;
              if (inMemBatter.AtBat_NonCaptainStarSwing == 2) {
                inMemBatter.Batter_Contact_SlapChargeBuntStar = Charge;
                inMemBatter.AtBat_Mystery_DidPopFlyOrGrounderConnect = true;
                inMemBatter.BatterAtPlate_BatterCharge_Up = 1.0;
              } else if (inMemBatter.AtBat_NonCaptainStarSwing < 2) {
                if (inMemBatter.AtBat_NonCaptainStarSwing != 0) {
                  inMemBatter.Batter_Contact_SlapChargeBuntStar = Charge;
                  inMemBatter.AtBat_Mystery_DidPopFlyOrGrounderConnect = true;
                  inMemBatter.BatterAtPlate_BatterCharge_Up = 1.0;
                }
              } else if (inMemBatter.AtBat_NonCaptainStarSwing < 4) {
                inMemBatter.Batter_Contact_SlapChargeBuntStar = Slap;
              }
            }
          }
          // else if (Team_CaptainRosterLoc[TeamBatting] == inMemBatter.AtBat_RosterID) {
          else if (false) {
          } else if (starsForBatter < 2) {
            inMemBatter.isStar = false;
          } else {
            inMemBatter.Batter_Contact_SlapChargeBuntStar = Star;
          }
        } else {
          inMemBatter.Batter_Contact_SlapChargeBuntStar = Star;
          inMemBatter.AtBat_MoonShot = true;
        }
        if (
          inMemBatter.Batter_Contact_SlapChargeBuntStar == Star ||
          inMemBatter.AtBat_Mystery_DidPopFlyOrGrounderConnect != false
        ) {
          inMemBatter.AtBat_Mystery7 = 0;
          inMemBatter.AtBat_Mystery_CaptainStarSwing =
            inMemBatter.AtBat_CaptainStarHitPitch;
        }
      }
    } else {
      inMemBatter.Batter_Contact_SlapChargeBuntStar = Bunt;
      inMemBatter.AtBat_MoonShot = false;
    }
  }
}

function hitBall() {
  let fVar1 = inMemBatter.ballContact_X;

  if (
    BattingExtensions[inMemBatter.AtBat_TrimmedBat][0] <=
    fVar1 - inMemBatter.posX
  ) {
    if (
      fVar1 - inMemBatter.posX <=
      BattingExtensions[inMemBatter.AtBat_TrimmedBat][1]
    ) {
      inMemBatter.interstitialBallContact_X = fVar1;
      return true;
    }
  }
  return false;
}


function convertPowerToVelocity(j) {
  inMemBall.ballVelocity = { X: 0, Y: 0, Z: 0 };
  inMemBall.ballAcceleration = { X: 0, Y: 0, Z: 0 };

  let half_power = Hit_HorizontalPower[j] * 0.5;

  let horizontalAngle = mssbConvertToRadians(Hit_HorizontalAngle[j]);
  let verticalAngle = mssbConvertToRadians(Hit_VerticalAngle[j]);

  let s_verticalAngle = Math.sin(verticalAngle);
  let c_verticalAngle = Math.cos(verticalAngle);

  let half_power_x_cos_vert_angle = half_power * c_verticalAngle;

  let c_horizontalAngle = Math.cos(horizontalAngle);
  let s_horizontalAngle = Math.sin(horizontalAngle);

  let x_groundVelocity = c_horizontalAngle * half_power_x_cos_vert_angle;
  let z_groundVelocity = s_horizontalAngle * half_power_x_cos_vert_angle;

  inMemBall.ballVelocity.X = x_groundVelocity / 100.0;
  inMemBall.ballVelocity.Y = (half_power * s_verticalAngle) / 100.0;
  inMemBall.ballVelocity.Z = z_groundVelocity / 100.0;

  inMemBall.ballAcceleration.X = 0.0;
  inMemBall.ballAcceleration.Y = AddedContactGravity;
  inMemBall.ballAcceleration.Z = 0.0;

  if (
    inMemBatter.Batter_IsBunting == false &&
    (Hit_HorizontalAngle[j] < 0x901 || 0xeff < Hit_HorizontalAngle[j])
  ) {
    // has Super Curve
    let hasSuperCurve =
      [0xe, 0x35, 0x25].find((x) => x == inMemBatter.Batter_CharID) != undefined
        ? 1
        : 0;
    if (readValues.oRSuperCurve != -1) {
      //override
      hasSuperCurve = readValues.oRSuperCurve;
    }

    // non-captain star swing 3 has super curve
    if (inMemBatter.nonCaptainStarSwingContact == 3) {
      hasSuperCurve = 1;
    }

    // if contact above 100, flip it
    let contact = inMemBatter.CalculatedBallPos;
    if (100.0 < inMemBatter.CalculatedBallPos) {
      contact = 200.0 - inMemBatter.CalculatedBallPos;
    }

    let vAngle = Hit_VerticalAngle[j];
    let fVar1 =
      1.0 -
      (1.0 - contact * 0.01) * FLOAT_ARRAY_ARRAY_807b72bc[hasSuperCurve][0];

    if (0x180 < vAngle && vAngle < 0x401) {
      let uVar3 = vAngle - 0x180;
      contact = uVar3;
      if (512.0 < uVar3) {
        contact = 512.0;
      }
      fVar1 = fVar1 * (1.0 - (contact * 1.0) / 512.0);
    }

    let hAngle = Hit_HorizontalAngle[j];

    if (hAngle < 0xc01 && 0xff < hAngle) {
      if (0x700 < hAngle) {
        hAngle = 0x700;
      }
    } else {
      hAngle = 0x100;
    }
    if (inMemBatter.AtBat_BatterHand != Righty) {
      hAngle = 0x800 - hAngle;
    }
    if (hAngle < 0x460) {
      contact = (0x460 - hAngle) / 864.0;
    } else {
      contact = (0x460 - hAngle) / 672.0;
    }

    contact = fVar1 * contact;
    if (0.0 <= contact) {
      if (0.0 < contact) {
        z_groundVelocity = -c_horizontalAngle;
        x_groundVelocity = s_horizontalAngle;
      }
    } else {
      contact = -contact;
      z_groundVelocity = c_horizontalAngle;
      x_groundVelocity = -s_horizontalAngle;
    }

    // finalize acceleration
    inMemBall.ballAcceleration.Z =
      z_groundVelocity * contact * FLOAT_ARRAY_ARRAY_807b72bc[hasSuperCurve][2];
    inMemBall.ballAcceleration.X =
      x_groundVelocity * contact * FLOAT_ARRAY_ARRAY_807b72bc[hasSuperCurve][1];

    // if z is backwards, flip it
    if (0.0 < inMemBall.ballAcceleration.Z) {
      inMemBall.ballAcceleration.Z = -inMemBall.ballAcceleration.Z;
    }
    // if batting lefty, flip it
    if (inMemBatter.AtBat_BatterHand != Righty) {
      inMemBall.ballAcceleration.X = -inMemBall.ballAcceleration.X;
    }
  }
}

function calculateHitGround(j) {
  let p = {
    X: 0,
    Y: BatterHitbox[inMemBatter.Batter_CharID].PitchingHeight,
    Z: 0,
  };
  CalculatedPoints[j] = [];

  let v = JSON.parse(JSON.stringify(inMemBall.ballVelocity));
  let a = JSON.parse(JSON.stringify(inMemBall.ballAcceleration));

  const airResistance = 0.996;
  const gravity = 0.00275;

  while (p.Y > 0) {
    CalculatedPoints[j].push({ X: p.X, Y: p.Y, Z: p.Z });

    p.X = p.X + v.X;
    p.Y = p.Y + v.Y;
    p.Z = p.Z + v.Z;

    v.X = v.X * airResistance + a.X;
    v.Y = (v.Y - gravity) * airResistance + a.Y;
    v.Z = v.Z * airResistance + a.Z;
  }

  //Display_Output["Hit Ground"] = { "Frames": CalculatedPoints.length, "Point": CalculatedPoints[CalculatedPoints.length - 1], "Distance": Math.sqrt(CalculatedPoints[CalculatedPoints.length - 1].X ** 2 + CalculatedPoints[CalculatedPoints.length - 1].Z ** 2) }
  //console.log(CalculatedPoints)
}

function calculateValues() {
  let i = 0;

  let obsPerDim = floor((numSims - 1) ** (1 / 3)) - 1;
  randomCounter1 = 0;
  randomCounter2 = 0;
  randomCounter3 = 0;

  CalculatedPoints.length = 0; //empty the array from the previous run.
  while (i < numSims) {
    if (i > 0) {
      // if not the first sim, then randomize
      //randomize RNG
      if (randomType == 0) {
        StaticRandomInt1 = floor(Math.random() * 32767);
        StaticRandomInt2 = floor(Math.random() * 32767);
        USHORT_8089269c = floor(Math.random() * 32767);
      } else {
        StaticRandomInt1 = (32767 * randomCounter1) / obsPerDim;
        StaticRandomInt2 = (32767 * randomCounter2) / obsPerDim;
        USHORT_8089269c = (32767 * randomCounter3) / obsPerDim;

        randomCounter1 += 1;
        if (randomCounter1 > obsPerDim) {
          randomCounter1 = 0;
          randomCounter2 += 1;
          if (randomCounter2 > obsPerDim) {
            randomCounter2 = 0;
            randomCounter3 += 1;
            if (randomCounter3 > obsPerDim) {
              randomCounter3 = 0;
            }
          }
        }
      }

      //randomize ball X, if chosen by the user.
      if (ballXRandom == true) {
        inMemBatter.interstitialBallContact_X =
          Math.random() * (ballXUpper - ballXLower) + ballXLower;
        inMemBatter.ballContact_X = inMemBatter.interstitialBallContact_X;
      }

      //randomize frame of contact, if chosen by the user.
      inMemBatter.Frame_SwingContact1 =
        Math.floor(Math.random() * (frameUpper - frameLower + 1)) + frameLower;
    }

    try {
      if (!hitBall()) {
        alert("These values would not make contact with the ball");
        return;
      }
      // await new Promise(r => setTimeout(r, 1));
    } catch (ex) {
      console.log(ex);
      alert(ex);
    }
    calculateContact();

    calculateHorizontalAngle(i);

    calculateVerticalAngle(i);

    calculateHitPower(i);

    convertPowerToVelocity(i);

    calculateHitGround(i);

    isHomeRun(i, ChosenStadium);

    hitNoteBlock(i);

    i += 1;
  }

  // check if hit was home run on other stadiums.
  let stadiumCounter = 0;
  stadiumCounter = 0;
  hRSum = 0;
  while (stadiumCounter < 6) {
    isHomeRun(0, parseInt(stadiumCounter));
    hRSum += homeRunInd[stadiumCounter][0];
    stadiumCounter += 1;
  }

  Display_Output["% Hit Note Block"] = average(
    hitNoteBlockInd
  );

  Display_Output["Hit Ground"] = {
    Frames: CalculatedPoints[0].length,
    Point: CalculatedPoints[0][CalculatedPoints[0].length - 1],
    Distance: Math.sqrt(
      CalculatedPoints[0][CalculatedPoints[0].length - 1].X ** 2 +
      CalculatedPoints[0][CalculatedPoints[0].length - 1].Z ** 2
    ),
  };
  console.log(CalculatedPoints[0]);
}

var horizontalCanvas = undefined;
var verticalCanvas = undefined;
var scaleCanvas = undefined;
var allBatsCanvas = undefined;
var contactCanvas = undefined;

function drawVerticalGraph() {
  let ctx = verticalCanvas.getContext("2d");
  ctx.clearRect(0, 0, verticalCanvas.width, verticalCanvas.height);
  ctx.font = "10px Arial";

  // Set line width
  ctx.lineWidth = 1;

  // Set fill Color
  let blackColor = "#000000FF";
  ctx.fillStyle = blackColor;
  ctx.strokeStyle = blackColor;

  // Make Lines
  let offset = { X: 20, Y: 250 };
  let origin = { X: 0, Y: 0 };
  let length = 180;
  let scale = length / outfieldWallDist[0];
  let highRange = degreeToPoint(90, length);
  let lowRange = degreeToPoint(0, length);

  // Draw Range lines
  ctx.beginPath();
  ctx.moveTo(highRange.X + offset.X, highRange.Y + offset.Y);
  ctx.lineTo(origin.X + offset.X, origin.Y + offset.Y);
  ctx.lineTo(lowRange.X + offset.X, lowRange.Y + offset.Y);
  ctx.lineTo(
    lowRange.X + offset.X,
    lowRange.Y + offset.Y - outfieldWallHeight[ChosenStadium][0] * scale
  ); //draw outfield wall
  ctx.lineTo(lowRange.X + offset.X, lowRange.Y + offset.Y);
  ctx.lineTo(origin.X + offset.X, origin.Y + offset.Y);
  ctx.closePath();
  ctx.stroke();

  // Selected Region
  let selectedAngles = anglesToArc(Display_Output["Vertical Range"]);

  let arcLength = length * 0.7;
  let i = 0;
  let transparency = "80";
  Display_Output["Vertical Zones"].forEach((element) => {
    // Draw vertical regions
    let theseAngles = anglesToArc(element);
    let this_length = arcLength + length * 0.1 * (i % 3);
    let this_transparency = transparency;

    if (i == Display_Output["Selected Vertical Zone"]) {
      this_length = length;
      this_transparency = "FF";
    }

    ctx.beginPath();
    ctx.moveTo(
      origin.X + offset.X,
      origin.Y + offset.Y - CalculatedPoints[0][0].Y * scale
    );
    ctx.arc(
      origin.X + offset.X,
      origin.Y + offset.Y - CalculatedPoints[0][0].Y * scale,
      this_length,
      theseAngles[0],
      theseAngles[1]
    );
    ctx.lineTo(
      origin.X + offset.X,
      origin.Y + offset.Y - CalculatedPoints[0][0].Y * scale
    );
    let fill =
      [
        "#FF0000",
        "#FF7F00",
        "#FFFF00",
        "#00FF00",
        "#0000FF",
        "#4B0082",
        "#9400D3",
      ][i % 7] + this_transparency;
    ctx.fillStyle = fill;
    ctx.fill();

    ctx.fillStyle = blackColor;
    let text_point = degreeToPoint(
      valueToDegrees((element[0] + element[1]) / 2),
      this_length
    );
    ctx.fillText(
      Display_Output["Vertical Zone Chances"][i] + "%",
      text_point.X + offset.X,
      text_point.Y + offset.Y - CalculatedPoints[0][0].Y * scale
    );
    i += 1;
  });

  ctx.strokeStyle = blackColor;

  // Draw point

  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(origin.X + offset.X, origin.Y + offset.Y);

  function pointToRender(x, y) {
    return { X: offset.X + x * scale, Y: offset.Y - y * scale };
  }

  hitToDraw.forEach((element) => {
    let newP = pointToRender(
      Math.sqrt(element.X ** 2 + element.Z ** 2),
      element.Y
    );
    ctx.lineTo(newP.X, newP.Y);
  });
  ctx.stroke();
}

function drawHorizontalGraph(stadiumNum) {
  let ctx = horizontalCanvas.getContext("2d");
  ctx.clearRect(0, 0, horizontalCanvas.width, horizontalCanvas.height);
  ctx.strokeStyle = "#000000";

  // Set line width
  ctx.lineWidth = 1;

  // Wall

  let offset = { X: horizontalCanvas.width / 2, Y: 300 };
  let origin = { X: 0, Y: 0 };
  let length = 175;
  let scale = length / Math.sqrt(2 * stadiums[stadiumNum].startingX[0] ** 2); // makes the scale equal to the left fould line of the stadium
  let leftPole = degreeToPoint(
    135,
    Math.sqrt(2 * stadiums[stadiumNum].startingX[0] ** 2) * scale
  );
  let rightPole = degreeToPoint(
    45,
    Math.sqrt(
      2 *
      stadiums[stadiumNum].endingX[stadiums[stadiumNum].endingX.length - 1] **
      2
    ) * scale
  );

  // Draw Mario Stadium boundaries
  /*ctx.beginPath();
    ctx.moveTo(leftPole.X + offset.X, leftPole.Y + offset.Y);
    ctx.lineTo(origin.X + offset.X, origin.Y + offset.Y);
    ctx.lineTo(rightPole.X + offset.X, rightPole.Y + offset.Y);
    ctx.lineTo(16*scale + offset.X, -100*scale + offset.Y);
    ctx.lineTo(-14*scale + offset.X, -100*scale +offset.Y);
    ctx.lineTo(-44*scale + offset.X, -78.7*scale + offset.Y);
    ctx.closePath();
    ctx.stroke();*/

  ctx.beginPath();
  ctx.moveTo(rightPole.X + offset.X, rightPole.Y + offset.Y);
  ctx.lineTo(origin.X + offset.X, origin.Y + offset.Y);
  ctx.lineTo(leftPole.X + offset.X, leftPole.Y + offset.Y);
  let segment = 0;
  while (segment < stadiums[stadiumNum].startingX.length) {
    let calcZ =
      stadiums[stadiumNum].m[segment] *
      stadiums[stadiumNum].startingX[segment] +
      stadiums[stadiumNum].c[segment];
    ctx.lineTo(
      stadiums[stadiumNum].startingX[segment] * scale + offset.X,
      -calcZ * scale + offset.Y
    );
    segment += 1;
  }
  ctx.closePath();
  ctx.stroke();

  // Draw batter
  if (inMemBatter.AtBat_BatterHand == Lefty) {
    isLefty = 1;
  } else {
    isLefty = 0;
  }
  ctx.fillStyle = "#000000";
  ctx.fillRect(offset.X - 10 + isLefty * 15, offset.Y - 10, 5, 10);

  // Draw horizontal region
  ctx.beginPath();
  ctx.moveTo(origin.X + offset.X, origin.Y + offset.Y);
  let angles = anglesToArc(Display_Output["Horizontal Range"], true);

  let angleBegin = angles[0];
  let angleEnd = angles[1];
  ctx.arc(
    origin.X + offset.X,
    origin.Y + offset.Y,
    length,
    angleBegin,
    angleEnd
  );
  ctx.lineTo(origin.X + offset.X, origin.Y + offset.Y);
  // ctx2.arc(origin.X + offset.X, origin.Y + offset.Y, length, degreesToRadian(360 - 111), degreesToRadian(360 - 45));
  ctx.fillStyle = "#FF000040";
  ctx.fill();

  // Draw Note Block Positions
  if (readValues.showNoteBlocks) {
    let blockNum = 0;
    while (blockNum < noteBlocks.length) {
      ctx.strokeText(
        "♪",
        offset.X + noteBlocks[blockNum].X * scale - 2,
        offset.Y - noteBlocks[blockNum].Z * scale
      );
      blockNum += 1;
    }
  }

  // Draw point
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(origin.X + offset.X, origin.Y + offset.Y);

  function pointToRender(x, y) {
    return { X: offset.X + x * scale, Y: offset.Y - y * scale };
  }

  hitToDraw.forEach((element) => {
    let newP = pointToRender(element.X, element.Z);
    ctx.lineTo(newP.X, newP.Y);
  });
  ctx.stroke();

  // draw coordinates of random simulations
  let i = 0;

  ctx.globalAlpha = 0.25;

  ctx.strokeStyle = "#FF0000";
  while (i < numSims) {
    ctx.beginPath();
    ctx.arc(
      CalculatedPoints[i][CalculatedPoints[i].length - 1].X * scale + offset.X,
      -CalculatedPoints[i][CalculatedPoints[i].length - 1].Z * scale + offset.Y,
      2,
      0,
      2 * Math.PI,
      false
    );
    ctx.stroke();
    i = i + 1;
  }

  plotMode = "compareSims"; //temp variable setter
  if ((plotMode = "compareSims" && runNum > 0)) {
    ctx.strokeStyle = "#0000ff80";
    let k = 0;
    while (k < CalculatedPointsPrev.length) {
      ctx.beginPath();
      ctx.arc(
        CalculatedPointsPrev[k][CalculatedPointsPrev[k].length - 1].X * scale +
        offset.X,
        -CalculatedPointsPrev[k][CalculatedPointsPrev[k].length - 1].Z * scale +
        offset.Y,
        2,
        0,
        2 * Math.PI,
        false
      );
      ctx.stroke();

      k += 1;
    }
  }
  ctx.globalAlpha = 1;
}

var allBatsBegin = 0;
function drawAllBatsGraph() {
  let ctx = allBatsCanvas.getContext("2d");
  let batImg = document.getElementById("batImg");
  let flippedBatImg = document.getElementById("batFlippedImg");
  let scale_0_100 = document.getElementById("scale0100");
  let scale_100_200 = document.getElementById("scale100200");

  let canvasHeight = allBatsCanvas.height;
  let canvasWidth = allBatsCanvas.width;

  ctx.fillStyle = "#FFFFFFFF";
  ctx.fillRect(0, 0, allBatsCanvas.width, allBatsCanvas.height);
  let left_side = -0.85;
  let right_side = 0.85;

  function valueToX(x) {
    let a = ((x - left_side) / (right_side - left_side)) * canvasWidth;
    return a;
  }

  const numSections = 54;
  const numBats = 9;

  let section_height = canvasHeight / numSections;
  let bat_height = section_height / numBats;

  let font_size = bat_height / 2;

  ctx.strokeStyle = "#000000FF";
  ctx.fillStyle = "#FFFFFFFF";
  ctx.font = font_size + "px Arial";

  offset = 0;
  for (let i = 0; i < numSections; i++) {
    let hFar = BatterHitbox[i].HorizontalRangeFar;
    let hNear = BatterHitbox[i].HorizontalRangeNear;

    function calcContactFar(x) {
      return 100.0 * (x / hFar) + 100.0;
    }

    function reverseCalcContactFar(x) {
      return (x - 100.0) * (hFar / 100.0);
    }

    function calcContactNear(x) {
      return -100.0 * (x / hNear) + 100.0;
    }

    function reverseCalcContactNear(x) {
      return (x - 100.0) * (hNear / -100.0);
    }

    let start_y = offset * section_height;
    offset += 1;
    let near = BattingExtensions[BatterHitbox[i].TrimmedBat][0];
    let far = BattingExtensions[BatterHitbox[i].TrimmedBat][1];

    // draw bat
    let near_x = valueToX(near);
    let far_x = valueToX(far);
    let length = far_x - near_x;

    let bat1_start = start_y + bat_height * 1;
    let bat1_height = bat_height - 5;

    let bat2_start = start_y + bat_height * 2 + 5;
    let bat2_height = bat_height - 5;

    // draw top bat
    ctx.fillStyle = "#FF0000FF";
    ctx.fillRect(0, bat1_start, canvasWidth, bat1_height);
    ctx.drawImage(
      scale_0_100,
      valueToX(0),
      bat1_start,
      valueToX(hNear) - valueToX(0),
      bat1_height
    );
    ctx.drawImage(
      scale_100_200,
      valueToX(0),
      bat1_start,
      valueToX(hFar) - valueToX(0),
      bat1_height
    );
    ctx.drawImage(batImg, near_x, bat1_start, length, bat1_height);

    ctx.fillStyle = "#FFFFFFFF";
    ctx.fillRect(
      valueToX(left_side),
      bat1_start,
      near_x - valueToX(left_side),
      bat1_height
    );
    ctx.fillRect(
      valueToX(right_side),
      bat1_start,
      far_x - valueToX(right_side),
      bat1_height
    );

    // draw bottom bat
    near_x = valueToX(-far);
    far_x = valueToX(-near);
    ctx.fillStyle = "#FF0000FF";
    ctx.fillRect(0, bat2_start, canvasWidth, bat2_height);
    ctx.drawImage(
      scale_0_100,
      valueToX(0),
      bat2_start,
      valueToX(hNear) - valueToX(0),
      bat2_height
    );
    ctx.drawImage(
      scale_100_200,
      valueToX(0),
      bat2_start,
      valueToX(hFar) - valueToX(0),
      bat2_height
    );
    ctx.drawImage(flippedBatImg, near_x, bat2_start, length, bat2_height);

    ctx.fillStyle = "#FFFFFFFF";
    ctx.fillRect(
      valueToX(left_side),
      bat2_start,
      near_x - valueToX(left_side),
      bat2_height
    );
    ctx.fillRect(
      valueToX(right_side),
      bat2_start,
      far_x - valueToX(right_side),
      bat2_height
    );

    //draw slap bats
    let bat3_start = start_y + bat_height * 3;
    let bat4_start = start_y + bat_height * 4;
    let bat3_height = bat_height;
    let bat4_height = bat_height;
    let thresholds = individualCalcContactThresholds(
      i,
      0,
      0,
      stats[i]["Can Be Captain"] == 1 ? true : false,
      0
    );

    thresholds = [
      valueToX(reverseCalcContactNear(thresholds.LeftNiceThreshold)),
      valueToX(reverseCalcContactNear(thresholds.LeftPerfectThreshold)),
      valueToX(reverseCalcContactFar(thresholds.RightPerfectThreshold)),
      valueToX(reverseCalcContactFar(thresholds.RightNiceThreshold)),
    ];
    // red background
    ctx.fillStyle = "#FF0000FF";
    ctx.fillRect(0, bat3_start, canvasWidth, bat3_height * 2);
    // yellow nice
    ctx.fillStyle = "#FFFF00FF";
    ctx.fillRect(
      thresholds[0],
      bat3_start,
      thresholds[3] - thresholds[0],
      bat3_height * 2
    );
    // green perfect
    ctx.fillStyle = "#00FF00FF";
    ctx.fillRect(
      thresholds[1],
      bat3_start,
      thresholds[2] - thresholds[1],
      bat3_height * 2
    );

    near_x = valueToX(near);
    far_x = valueToX(far);
    ctx.drawImage(batImg, near_x, bat3_start, length, bat3_height);
    ctx.fillStyle = "#FFFFFFFF";
    ctx.fillRect(
      valueToX(left_side),
      bat3_start,
      near_x - valueToX(left_side),
      bat3_height
    );
    ctx.fillRect(
      valueToX(right_side),
      bat3_start,
      far_x - valueToX(right_side),
      bat3_height
    );

    near_x = valueToX(-far);
    far_x = valueToX(-near);
    ctx.drawImage(flippedBatImg, near_x, bat4_start, length, bat4_height);
    ctx.fillRect(
      valueToX(left_side),
      bat4_start,
      near_x - valueToX(left_side),
      bat4_height
    );
    ctx.fillRect(
      valueToX(right_side),
      bat4_start,
      far_x - valueToX(right_side),
      bat4_height
    );

    //draw charge bats
    let bat5_start = start_y + bat_height * 5;
    let bat6_start = start_y + bat_height * 6;
    let bat5_height = bat_height;
    let bat6_height = bat_height;
    thresholds = individualCalcContactThresholds(
      i,
      1,
      0,
      stats[i]["Can Be Captain"] == 1 ? true : false,
      0
    );

    thresholds = [
      valueToX(reverseCalcContactNear(thresholds.LeftNiceThreshold)),
      valueToX(reverseCalcContactNear(thresholds.LeftPerfectThreshold)),
      valueToX(reverseCalcContactFar(thresholds.RightPerfectThreshold)),
      valueToX(reverseCalcContactFar(thresholds.RightNiceThreshold)),
    ];

    // red background
    ctx.fillStyle = "#FF0000FF";
    ctx.fillRect(0, bat5_start, canvasWidth, bat5_height * 2);
    // yellow nice
    ctx.fillStyle = "#FFFF00FF";
    ctx.fillRect(
      thresholds[0],
      bat5_start,
      thresholds[3] - thresholds[0],
      bat5_height * 2
    );
    // green perfect
    ctx.fillStyle = "#00FF00FF";
    ctx.fillRect(
      thresholds[1],
      bat5_start,
      thresholds[2] - thresholds[1],
      bat5_height * 2
    );

    near_x = valueToX(near);
    far_x = valueToX(far);
    ctx.drawImage(batImg, near_x, bat5_start, length, bat5_height);
    ctx.fillStyle = "#FFFFFFFF";
    ctx.fillRect(
      valueToX(left_side),
      bat5_start,
      near_x - valueToX(left_side),
      bat5_height
    );
    ctx.fillRect(
      valueToX(right_side),
      bat5_start,
      far_x - valueToX(right_side),
      bat5_height
    );

    near_x = valueToX(-far);
    far_x = valueToX(-near);
    ctx.drawImage(flippedBatImg, near_x, bat6_start, length, bat6_height);
    ctx.fillRect(
      valueToX(left_side),
      bat6_start,
      near_x - valueToX(left_side),
      bat6_height
    );
    ctx.fillRect(
      valueToX(right_side),
      bat6_start,
      far_x - valueToX(right_side),
      bat6_height
    );

    //draw star bats
    let bat7_start = start_y + bat_height * 7;
    let bat8_start = start_y + bat_height * 8;
    let bat7_height = bat_height;
    let bat8_height = bat_height;
    thresholds = individualCalcContactThresholds(
      i,
      2,
      0,
      stats[i]["Can Be Captain"] == 1 ? true : false,
      0
    );

    thresholds = [
      valueToX(reverseCalcContactNear(thresholds.LeftNiceThreshold)),
      valueToX(reverseCalcContactNear(thresholds.LeftPerfectThreshold)),
      valueToX(reverseCalcContactFar(thresholds.RightPerfectThreshold)),
      valueToX(reverseCalcContactFar(thresholds.RightNiceThreshold)),
    ];

    // red background
    ctx.fillStyle = "#FF0000FF";
    ctx.fillRect(0, bat7_start, canvasWidth, bat7_height * 2);
    // yellow nice
    ctx.fillStyle = "#FFFF00FF";
    ctx.fillRect(
      thresholds[0],
      bat7_start,
      thresholds[3] - thresholds[0],
      bat7_height * 2
    );
    // green perfect
    ctx.fillStyle = "#00FF00FF";
    ctx.fillRect(
      thresholds[1],
      bat7_start,
      thresholds[2] - thresholds[1],
      bat7_height * 2
    );

    near_x = valueToX(near);
    far_x = valueToX(far);
    ctx.drawImage(batImg, near_x, bat7_start, length, bat7_height);
    ctx.fillStyle = "#FFFFFFFF";
    ctx.fillRect(
      valueToX(left_side),
      bat7_start,
      near_x - valueToX(left_side),
      bat7_height
    );
    ctx.fillRect(
      valueToX(right_side),
      bat7_start,
      far_x - valueToX(right_side),
      bat7_height
    );

    near_x = valueToX(-far);
    far_x = valueToX(-near);
    ctx.drawImage(flippedBatImg, near_x, bat8_start, length, bat8_height);
    ctx.fillRect(
      valueToX(left_side),
      bat8_start,
      near_x - valueToX(left_side),
      bat8_height
    );
    ctx.fillRect(
      valueToX(right_side),
      bat8_start,
      far_x - valueToX(right_side),
      bat8_height
    );

    ctx.beginPath();
    ctx.moveTo(0, start_y);
    ctx.lineTo(canvasWidth, start_y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, bat3_start);
    ctx.lineTo(canvasWidth, bat3_start);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, bat5_start);
    ctx.lineTo(canvasWidth, bat5_start);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, bat7_start);
    ctx.lineTo(canvasWidth, bat7_start);
    ctx.stroke();

    ctx.fillStyle = "#000000FF";
    ctx.fillText(stats[i].Name, 0, start_y + font_size);

    ctx.fillText("Slap", valueToX(far), bat3_start + font_size);

    ctx.fillText("Charge", valueToX(far), bat5_start + font_size);

    ctx.fillText("Star", valueToX(far), bat7_start + font_size);
  }

  ctx.font = 10 + "px Arial";
  for (let i = left_side; i <= right_side + 0.01; i += 0.05) {
    i = Number.parseFloat(i.toFixed(2));
    let dist = right_side - left_side;

    let u = ((i - left_side) / dist) * canvasWidth;

    ctx.strokeStyle = "#00000040";
    ctx.beginPath();
    ctx.moveTo(u, 0);
    ctx.lineTo(u, canvasHeight);
    ctx.stroke();

    for (let ii = 0; ii < numSections; ii++) {
      ctx.fillText(
        i.toFixed(2),
        u - 10,
        canvasHeight * (ii / numSections) + bat_height * 2 + 4
      );
    }
  }
}

function drawScaleGraph() {
  let ctx = scaleCanvas.getContext("2d");
  ctx.clearRect(0, 0, scaleCanvas.width, scaleCanvas.height);
  let canvasWidth = scaleCanvas.width;
  let canvasHeight = scaleCanvas.height;
  canvasHeight;
  let gradient_transparency = "FF";
  let grad = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  grad.addColorStop(0, "red");
  grad.addColorStop(0.25, "yellow");
  grad.addColorStop(0.5, "green");
  grad.addColorStop(0.75, "yellow");
  grad.addColorStop(1, "red");

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, scaleCanvas.width, scaleCanvas.height);

  let maxMark = 200;
  ctx.strokeStyle = "#000000FF";
  ctx.lineWidth = 2;

  for (let i = 0; i <= maxMark; i += 10) {
    let y_coord = ((maxMark - i) / maxMark) * canvasHeight;

    let font_size = 50;
    ctx.font = font_size + "px Arial";

    let text_height = font_size;
    let text_width = (font_size * i.toString().length) / 2;

    let start_x = canvasWidth / 2 - text_width / 2;
    let start_y = y_coord + font_size / 3;

    let end_y = start_y - text_height;
    let end_x = start_x + text_width;

    if (i == 0) {
      start_y -= text_height / 2;

      ctx.beginPath();
      ctx.moveTo(0, y_coord);
      ctx.lineTo(canvasWidth, y_coord);
      ctx.stroke();
    } else if (i == 200) {
      start_y += text_height / 2;

      ctx.beginPath();
      ctx.moveTo(0, y_coord);
      ctx.lineTo(canvasWidth, y_coord);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(0, y_coord);
      ctx.lineTo(start_x, y_coord);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(end_x, y_coord);
      ctx.lineTo(canvasWidth, y_coord);
      ctx.stroke();
    }

    ctx.fillStyle = "#000000FF";
    ctx.fillText(100 - Math.abs(100 - i), start_x, start_y);
  }

  return;
}

function drawContactGraph() {
  let ctx = contactCanvas.getContext("2d");
  ctx.clearRect(0, 0, contactCanvas.width, contactCanvas.height);
  ctx.fillStyle = "#FF000000";
  ctx.fillRect(0, 0, contactCanvas.width, contactCanvas.height);
  let canvasWidth = contactCanvas.width;
  let canvasHeight = contactCanvas.height;

  ctx.lineWidth = 1;
  let transparency = "FF";
  ctx.strokeStyle = "#FFFFFF" + transparency;

  let colors = ["#FF0000", "#FFFF00", "#00FF00", "#FFFF00", "#FF0000"];

  let boxWidth = 500;
  let boxHeight = 250;
  let boxOffsetX = 30;
  let boxOffsetY = canvasHeight - boxHeight - 75;

  let stripWidth = 20;
  let stripGap = 20;

  const bottomOfTheBoxY = boxHeight + boxOffsetY;

  // main box
  ctx.strokeRect(boxOffsetX, boxOffsetY, boxWidth, boxHeight);

  // top strip
  let topStripBeginY = boxOffsetY - stripGap;
  let topStripEndY = boxOffsetY - stripGap - stripWidth;
  let bottomStripBeginY = boxOffsetY + boxHeight + stripGap;
  let bottomStripEndY = boxOffsetY + boxHeight + stripGap + stripWidth;
  // ctx.fillStyle = colors[1] + transparency;

  // bottom strip
  let sideStripBeginX = boxOffsetX + boxWidth + stripGap;
  let sideStripEndX = boxOffsetX + boxWidth + stripGap + stripWidth;
  // ctx.fillStyle = colors[2] + transparency;

  const ZeroContact = boxOffsetY + boxHeight;
  const TwoHundredContact = boxOffsetY;

  function convertContactToY(c) {
    return (
      ((200 - c) / 200) * (ZeroContact - TwoHundredContact) + TwoHundredContact
    );
  }

  function convertYToContact(c) {
    return -(
      (200 * (c - ZeroContact)) / (ZeroContact - TwoHundredContact) -
      200
    );
  }

  function normalToXCoord(x) {
    return boxOffsetX + boxWidth * x;
  }

  let hFar = BatterHitbox[inMemBatter.Batter_CharID].HorizontalRangeFar;
  let hNear = BatterHitbox[inMemBatter.Batter_CharID].HorizontalRangeNear;

  let nearReach = BattingExtensions[inMemBatter.AtBat_TrimmedBat][0];
  let farReach = BattingExtensions[inMemBatter.AtBat_TrimmedBat][1];

  function positionToNormal(x) {
    const nearMap = -0.85;
    const farMap = 0.85;
    return (x - nearMap) / (farMap - nearMap);
  }

  let midpoint = positionToNormal(0);
  let hitPoint = positionToNormal(
    inMemBatter.interstitialBallContact_X - inMemBatter.posX
  );
  if (inMemBatter.AtBat_BatterHand == Lefty) {
    hitPoint = 1 - hitPoint;
  }

  function calcContactFar(x) {
    return 100.0 * (x / hFar) + 100.0;
  }

  function reverseCalcContactFar(x) {
    return (x - 100.0) * (hFar / 100.0);
  }

  function calcContactNear(x) {
    return -100.0 * (x / hNear) + 100.0;
  }

  function reverseCalcContactNear(x) {
    return (x - 100.0) * (hNear / -100.0);
  }

  // draw contact dividing line
  let begin_chart = [0, undefined];
  let mid_chart = [midpoint, 100];
  let end_chart = [1, undefined];

  begin_chart[1] = calcContactNear(-0.85);
  end_chart[1] = calcContactFar(0.85);

  if (begin_chart[1] < 0) {
    begin_chart[0] = positionToNormal(reverseCalcContactNear(0));
    begin_chart[1] = 0;
  } else if (begin_chart > 200) {
    begin_chart[0] = positionToNormal(reverseCalcContactNear(200));
    begin_chart[1] = 200;
  }

  if (end_chart[1] < 0) {
    end_chart[0] = positionToNormal(reverseCalcContactFar(0));
    end_chart[1] = 0;
  } else if (end_chart[1] > 200) {
    end_chart[0] = positionToNormal(reverseCalcContactFar(200));
    end_chart[1] = 200;
  }

  ctx.strokeStyle = "#4000FFFF";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(normalToXCoord(begin_chart[0]), convertContactToY(begin_chart[1]));
  ctx.lineTo(normalToXCoord(mid_chart[0]), convertContactToY(mid_chart[1]));
  ctx.lineTo(normalToXCoord(end_chart[0]), convertContactToY(end_chart[1]));
  ctx.stroke();
  ctx.strokeStyle = "#000000FF";

  // get lines for contact
  let contactYs = [];
  contactYs.push(convertContactToY(200));
  let contactXs = [];
  contactXs.push(normalToXCoord(1));

  ctx.lineWidth = 1;

  let i = 0;
  ctx.fillStyle = "#000000FF";
  ctx.setLineDash([5, 5]);

  [
    inMemBatter.RightNiceThreshold,
    inMemBatter.RightPerfectThreshold,
    inMemBatter.LeftPerfectThreshold,
    inMemBatter.LeftNiceThreshold,
  ].forEach((e) => {
    let fy = convertContactToY(e);

    ctx.beginPath();
    ctx.moveTo(sideStripEndX, fy);
    let verticalEnd = undefined;
    if (e < 100) {
      verticalEnd = reverseCalcContactNear(e);
    } else {
      verticalEnd = reverseCalcContactFar(e);
    }

    let fx = normalToXCoord(positionToNormal(verticalEnd));

    if (positionToNormal(verticalEnd) > 1) {
      ctx.lineTo(boxOffsetX + boxWidth, fy);
      ctx.stroke();

      fx = normalToXCoord(1);
    } else if (positionToNormal(verticalEnd) < 0) {
      ctx.lineTo(boxOffsetX, fy);
      ctx.stroke();

      fx = normalToXCoord(0);
    } else {
      ctx.lineTo(fx, fy);
      ctx.stroke();

      [
        [1, boxOffsetY, topStripEndY - 5],
        [-1, bottomOfTheBoxY, bottomStripEndY + 15],
      ].forEach((e) => {
        // check if it hits the bat, with scaling for lefty/righty
        if (
          verticalEnd <= Math.max(nearReach * e[0], farReach * e[0]) &&
          verticalEnd >= Math.min(nearReach * e[0], farReach * e[0])
        ) {
          ctx.beginPath();
          ctx.moveTo(fx, fy);
          ctx.lineTo(fx, e[1]);
          ctx.stroke();

          ctx.font = "10px Arial";
          ctx.fillText(
            e[0] * verticalEnd.toFixed(4),
            fx,
            e[2] - 10 * (i % 2) * e[0]
          );
        }
      });
    }

    contactYs.push(fy);
    contactXs.push(fx);
    ctx.fillText(e.toFixed(2), sideStripEndX + 5 + 35 * (i == 2), fy);
    i++;
  });
  contactYs.push(convertContactToY(0));
  contactXs.push(normalToXCoord(0));

  ctx.setLineDash([]);

  // draw text for furthest reaches of the bat
  ctx.fillText(
    nearReach,
    normalToXCoord(positionToNormal(nearReach)) - 30,
    (topStripBeginY + topStripEndY) / 2 + 5
  );
  ctx.fillText(
    farReach,
    normalToXCoord(positionToNormal(farReach)) + 5,
    (topStripBeginY + topStripEndY) / 2 + 5
  );
  ctx.fillText(
    nearReach,
    normalToXCoord(positionToNormal(-nearReach)) + 5,
    (bottomStripBeginY + bottomStripEndY) / 2 + 5
  );
  ctx.fillText(
    farReach,
    normalToXCoord(positionToNormal(-farReach)) - 30,
    (bottomStripBeginY + bottomStripEndY) / 2 + 5
  );

  // draw contact value for tip of the bat
  ctx.fillText(
    "Contact: " + calcContactNear(nearReach).toFixed(0),
    normalToXCoord(positionToNormal(nearReach)) - 30,
    (topStripBeginY + topStripEndY) / 2 + 20
  );
  ctx.fillText(
    "Contact: " + calcContactFar(farReach).toFixed(0),
    normalToXCoord(positionToNormal(farReach)) + 5,
    (topStripBeginY + topStripEndY) / 2 + 20
  );
  ctx.fillText(
    "Contact: " + calcContactFar(-nearReach).toFixed(0),
    normalToXCoord(positionToNormal(-nearReach)) - 25,
    bottomStripBeginY - 3
  );
  ctx.fillText(
    "Contact: " + calcContactNear(-farReach).toFixed(0),
    normalToXCoord(positionToNormal(-farReach)) - 30,
    bottomStripBeginY - 3
  );

  // draw top and bottom
  ctx.fillText(200, sideStripEndX + 5, convertContactToY(200));
  ctx.fillText(0, sideStripEndX + 5, convertContactToY(0));

  // draw bat up top
  [
    { offset: topStripBeginY, width: -stripWidth, scale: 1 },
    { offset: bottomStripBeginY, width: stripWidth, scale: -1 },
  ].forEach((e) => {
    for (let i = 0; i < contactXs.length - 1; i++) {
      ctx.fillStyle = colors[i] + transparency;
      let this_begin = Math.min(contactXs[i], contactXs[i + 1]);
      let this_end = Math.max(contactXs[i], contactXs[i + 1]);

      let near_coord = normalToXCoord(positionToNormal(e.scale * nearReach));
      let far_coord = normalToXCoord(positionToNormal(e.scale * farReach));

      let temp_near = Math.min(near_coord, far_coord);
      let temp_far = Math.max(near_coord, far_coord);

      near_coord = temp_near;
      far_coord = temp_far;

      this_begin = Math.min(Math.max(near_coord, this_begin), far_coord);
      this_end = Math.min(Math.max(near_coord, this_end), far_coord);

      ctx.fillRect(this_begin, e.offset, this_end - this_begin, e.width);
    }
  });

  // draw bat on side
  for (let i = 0; i < contactYs.length - 1; i++) {
    ctx.fillStyle = colors[i] + transparency;
    ctx.fillRect(
      sideStripBeginX,
      contactYs[i],
      stripWidth,
      contactYs[i + 1] - contactYs[i]
    );
  }

  let batImg = document.getElementById("batImg");
  let flippedBatImg = document.getElementById("batFlippedImg");

  ctx.drawImage(
    batImg,
    normalToXCoord(positionToNormal(nearReach)),
    topStripEndY,
    normalToXCoord(positionToNormal(farReach)) -
    normalToXCoord(positionToNormal(nearReach)),
    stripWidth
  );
  ctx.drawImage(
    flippedBatImg,
    normalToXCoord(positionToNormal(-nearReach)),
    bottomStripBeginY,
    normalToXCoord(positionToNormal(-farReach)) -
    normalToXCoord(positionToNormal(-nearReach)),
    stripWidth
  );

  // Draw current contact
  ctx.lineWidth = 2;
  ctx.beginPath();

  ctx.moveTo(
    sideStripBeginX + stripWidth,
    convertContactToY(inMemBatter.CalculatedBallPos)
  );
  ctx.lineTo(
    normalToXCoord(hitPoint),
    convertContactToY(inMemBatter.CalculatedBallPos)
  );
  if (inMemBatter.AtBat_BatterHand == Lefty) {
    ctx.lineTo(
      normalToXCoord(hitPoint),
      bottomOfTheBoxY + stripGap + stripWidth
    );
    ctx.stroke();

    ctx.setLineDash([1, 5]);
    ctx.beginPath();
    ctx.moveTo(
      normalToXCoord(hitPoint),
      convertContactToY(inMemBatter.CalculatedBallPos)
    );
    ctx.lineTo(normalToXCoord(hitPoint), boxOffsetY);
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    ctx.lineTo(normalToXCoord(hitPoint), boxOffsetY - stripGap - stripWidth);
    ctx.stroke();

    ctx.setLineDash([1, 5]);
    ctx.beginPath();
    ctx.moveTo(
      normalToXCoord(hitPoint),
      convertContactToY(inMemBatter.CalculatedBallPos)
    );
    ctx.lineTo(normalToXCoord(hitPoint), bottomOfTheBoxY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Draw the ball
  let ballImg = document.getElementById("ballImg");
  let ballWidth = 20;
  let ballMid = [
    normalToXCoord(hitPoint) - ballWidth / 2,
    convertContactToY(inMemBatter.CalculatedBallPos) - ballWidth / 2,
  ];

  ctx.drawImage(ballImg, ballMid[0], ballMid[1], ballWidth, ballWidth);

  // outline the boxes on the side
  // ctx.strokeRect(boxOffsetX, topStripBeginY, boxWidth, -stripWidth);
  // ctx.strokeRect(boxOffsetX, bottomStripBeginY, boxWidth, stripWidth);
  ctx.strokeRect(sideStripBeginX, boxOffsetY, stripWidth, boxHeight);
  ctx.fillStyle = "#000000FF";
  ctx.font = "30px Arial";
  ctx.fillText(inMemBatter.Name + " Batter Reaches", 0, 30);
}

function renderTrajectories() {
  hitToDraw = CalculatedPoints[0];

  drawVerticalGraph();
  drawHorizontalGraph(ChosenStadium);
  // drawScaleGraph();
  // drawAllBatsGraph();
  drawContactGraph();
}

function displayValues() {
  let output = document.getElementById("outputText");
  Display_Output["Horzontal Hit Angle"] = Hit_HorizontalAngle[0];
  Display_Output["Vertical Hit Angle"] = Hit_VerticalAngle[0];
  Display_Output["Power"] = Hit_HorizontalPower[0];
  Display_Output["Horzontal Hit Angle (in degrees)"] =
    ((Hit_HorizontalAngle[0] - 0x400) * 360) / 4096;
  Display_Output["Vertical Hit Angle (in degrees)"] =
    (Hit_VerticalAngle[0] * 360) / 4096;
  Display_Output["ball"] = inMemBall;
  Display_Output["Is Home Run?"] = homeRunInd[ChosenStadium][0];
  Display_Output["% of RNG that would've resulted in a Home Run"] = average(
    homeRunInd[ChosenStadium]
  );
  Display_Output["# of stadiums that hit would've been a HR at (out of 6)"] =
    hRSum;
  if (randomContactHRFinished == 1) {
    Display_Output["% HR on random contact"] = randHrPercent;
  }
  Display_Output["% Hit Note Block"] = average(
    hitNoteBlockInd
  );
  // output.innerText = JSON.stringify(Display_Output, null, 4);

  // tidy up the display
  function iterateObject(obj, indent = "") {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];

        if (typeof value === "object") {
          output.innerHTML += `${indent}${key}:<br>`;
          iterateObject(value, `${indent}&nbsp;&nbsp;&nbsp;&nbsp;`);
        } else {
          output.innerHTML += `${indent}${key}: ${value}<br>`;
        }
      }
    }
  }

  output.innerHTML = "";
  for (const key in Display_Output) {
    if (Display_Output.hasOwnProperty(key)) {
      const value = Display_Output[key];

      if (typeof value === "object") {
        output.innerHTML += `<strong>${key}</strong>:<br>`;
        iterateObject(value, "&nbsp;&nbsp;&nbsp;&nbsp;");
      } else {
        output.innerHTML += `<strong>${key}</strong>: ${value}<br>`;
      }
    }
  }
  Object.entr;
}

document.addEventListener("DOMContentLoaded", function (event) {
  horizontalCanvas = document.getElementById("horizontalOutput");
  verticalCanvas = document.getElementById("verticalOutput");
  scaleCanvas = document.getElementById("scaleGraph");
  contactCanvas = document.getElementById("contactOutput");
  allBatsCanvas = document.getElementById("allBatsGraph");

  document.getElementById("submitData").onclick = async function (ev) {
    parseInputs();
    parseValues();
    calculateBall();
    CalculatedPointsPrev.length = 0;
    CalculatedPointsPrev = CalculatedPoints.slice(0); //track previous simulations so they can be used for comparision on the next run;
    runNum += 1;
  };

  document.getElementById("randomData").onclick = async function (ev) {
    randomInputs();
    parseInputs();
    parseValues();
    calculateBall();
    CalculatedPointsPrev.length = 0;
    CalculatedPointsPrev = CalculatedPoints.slice(0); //track previous simulations so they can be used for comparision on the next run;
    runNum += 1;
  };

  document.getElementById("useStatFileValues").onclick = async function (ev) {
    useStatFileValues()
  };

  //Take stat file input and put into textbox so it can be parsed
  document.getElementById('import').onclick = function () {
    var files = document.getElementById('selectFiles').files;
    console.log(files);
    if (files.length <= 0) {
      return false;
    }

    var fr = new FileReader();

    fr.onload = function (e) {
      console.log(e);
      var result = JSON.parse(e.target.result);
      var formatted = JSON.stringify(result, null, 2);
      document.getElementById('result').value = formatted;
    }

    fr.readAsText(files.item(0));
  };




  document.getElementById("randomHR").onclick = async function (ev) {
    randHrPercent = [];
    randomContactHRFinished = 0;
    homeRunInd = [[0], [0], [0], [0], [0], [0], [0]];

    let character = 0;
    while (character < 54) {
      parseInputs();

      readValues.batter_id = character;

      readValues.ballContact_X = 0;

      if (BatterHitbox[character].TrimmedBat == 0) {
        readValues.ballContact_X_Lower = -0.85;
        readValues.ballContact_X_Upper = 0.15;
      } else {
        readValues.ballContact_X_Lower = -0.35;
        readValues.ballContact_X_Upper = 0.35;
      }
      parseValues();
      calculateBall();
      CalculatedPointsPrev.length = 0;
      CalculatedPointsPrev = CalculatedPoints.slice(0); //track previous simulations so they can be used for comparision on the next run;
      runNum += 1;

      randHrPercent[character] = [
        stats[character].Name,
        average(homeRunInd[ChosenStadium])
      ];

      character += 1;
    }
    randomContactHRFinished = 1;
    displayValues();
  };
});

function calculateBall() {
  try {
    if (!hitBall()) {
      alert("These values would not make contact with the ball");
      return;
    }
    calculateValues();
    displayValues();
    renderTrajectories();
    // await new Promise(r => setTimeout(r, 1));
  } catch (ex) {
    console.log(ex);
    alert(ex);
  }
}

function isHomeRun(j, stadiumNum) {
  homeRunInd[stadiumNum][j] = 0;

  CalculatedPoints[j].forEach((element) => {
    if (homeRunInd[stadiumNum][j] == 1) {
      // nothing
    } else if (element.X < stadiums[stadiumNum].startingX[0]) {
      //foul
      outfieldWallDist[j] = Math.sqrt(
        2 * stadiums[stadiumNum].startingX[0] ** 2
      );
      outfieldWallHeight[stadiumNum][j] = stadiums[stadiumNum].wallHeight[0];
    } else if (
      element.X >
      stadiums[stadiumNum].endingX[stadiums[stadiumNum].startingX.length - 1]
    ) {
      //foul
      outfieldWallDist[j] = Math.sqrt(
        2 *
        stadiums[stadiumNum].endingX[
        stadiums[stadiumNum].startingX.length - 1
        ] **
        2
      );
      outfieldWallHeight[stadiumNum][j] =
        stadiums[stadiumNum].wallHeight[
        stadiums[stadiumNum].startingX.length - 1
        ];
    } else {
      let segment = 0;
      while (segment < stadiums[stadiumNum].startingX.length) {
        if (
          element.X >= stadiums[stadiumNum].startingX[segment] &&
          element.X < stadiums[stadiumNum].endingX[segment]
        ) {
          let wallZ =
            stadiums[stadiumNum].m[segment] * element.X +
            stadiums[stadiumNum].c[segment];
          outfieldWallDist[j] = Math.sqrt(element.X ** 2 + wallZ ** 2);
          outfieldWallHeight[stadiumNum][j] =
            stadiums[stadiumNum].wallHeight[segment];
          if (element.Z > wallZ) {
            if (element.Y > stadiums[stadiumNum].wallHeight[segment]) {
              homeRunInd[stadiumNum][j] = 1;
              outfieldWallDist[j] = Math.sqrt(element.X ** 2 + element.Z ** 2);
              outfieldWallHeight[stadiumNum][j] =
                stadiums[stadiumNum].wallHeight[segment];
            }
          }
        }
        segment += 1;
      }
    }
  });
}

function hitNoteBlock(j) {
  hitNoteBlockInd[j] = 0;
  CalculatedPoints[j].forEach((element) => {
    if (hitNoteBlockInd[j] != 0) {
      //nothing
    } else if (element.Y > 6 && element.Y < 15) {
      let blockNum = 0;
      while (blockNum < noteBlocks.length) {
        let blockBallDist = Math.sqrt(
          (noteBlocks[blockNum].X - element.X) ** 2 +
          (noteBlocks[blockNum].Y - element.Y) ** 2 +
          (noteBlocks[blockNum].Z - element.Z) ** 2
        );
        if (blockBallDist < 2) {
          hitNoteBlockInd[j] = 1;
          if (noteBlocks[blockNum].Type == "Random") {
            hitNoteBlockInd[j] =
              hitNoteBlockInd[j] * readValues.invisToNotePercent;
          }
          break;
        }
        blockNum += 1;
      }
    }
  });
}