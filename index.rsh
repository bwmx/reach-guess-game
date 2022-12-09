'reach 0.1';
'use strict';

const GameDetails = Object({
  winningNumber: UInt, // what is the number to guess?
  price: UInt, // how much does it cost per guess?
  deadline: UInt, // not currently used
  benefactor: Address, // who will get the commission upon game completion
});

const checkWinner = (winningNumberDigest, guessPlayer) => {
  return winningNumberDigest === digest(guessPlayer);
};

const getPercentOf = (num, percent) => {
  return muldiv(num, percent, 100);
}

export const main = Reach.App(() => {
  const Admin = Participant('Admin', {
    ...hasRandom,
    details: GameDetails,
    launched: Fun([Contract], Null),
    showWinner: Fun([Address], Null),
  });

  const Player = API('Player', {
    guess: Fun([UInt], Bool)
  });

  const V = View({
    price: UInt, // how much does it cost per guess?
    totalGuesses: UInt, // how many have guessed so far?
    prizePot: UInt,
  });

  init();

  Admin.only(() => {
    const { price, deadline, benefactor } = declassify(interact.details);
    const _winningNumber = interact.details.winningNumber;
    const digestWinningNumber = declassify(digest(_winningNumber));
  });
  Admin.publish(price, deadline, benefactor, digestWinningNumber)
    .pay(price)
    .check(() => {
      check(price > 0, "price is above zero");
    })
  // todo, timeout and closeTo Admin if contract not initialised properly

  // initialize view
  V.price.set(price);
  V.totalGuesses.set(0);
  V.prizePot.set(getPercentOf(price, 95)); // admin will pay (see above) to create an initial prize pot

  // notify admin front-end of deployed contract info
  Admin.only(() => {
    interact.launched(getContract());
  });

  const [keepGoing, winner, numGuesses] = parallelReduce([true, benefactor, 0])
    .invariant(balance() == (numGuesses * price) + price, "balance is accurate")
    .while(keepGoing)
    .api_(Player.guess, (guess) => {
      check(keepGoing, "it's already over")
      check(this !== Admin, "admin can't play their own game")

      return [price, (ret) => {
        const isWinner = checkWinner(digestWinningNumber, guess);
        ret(isWinner);
        return [!isWinner, isWinner ? this : winner, numGuesses + 1];
      }]
    })
    .define(() => {
      V.totalGuesses.set(numGuesses + 1);
      V.prizePot.set(getPercentOf((numGuesses * price) + price, 95));
    });
  // timeout absent, game runs forever until winner

  const handlePayouts = () => {
    const prizePot = (numGuesses * price) + price;
    // transfer winner 95% of prize pot
    transfer(getPercentOf(prizePot, 95)).to(winner);
    // transfer 5% as commission
    transfer(getPercentOf(prizePot, 5)).to(benefactor);
    // give the rest back to the creator (Admin)
    transfer(balance()).to(Admin);
  };

  // notify admin who won
  Admin.only(() => {
    interact.showWinner(winner);
  })

  // pay the winner, creator and benefactor
  handlePayouts();

  commit();
  exit();
});
