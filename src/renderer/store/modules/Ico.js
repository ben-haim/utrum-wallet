import * as _ from 'lodash';
import moment from 'moment';
import bitcoinjs from 'bitcoinjs-lib';

const state = {
  associatedTxs: [],
  pendingSwaps: [],
};

const mutations = {
  UPDATE_ASSOCIATED_TXS(state, associations) {
    state.associatedTxs = associations;
  },
  ADD_PENDING_TX(state, newPendingTx) {
    state.pendingSwaps.unshift(newPendingTx);
  },
  DELETE_PENDING_TX(state, pendingTxHash) {
    state.pendingSwaps = _.filter(state.pendingSwaps, (pendingSwap) => {
      return pendingSwap.cryptoTx.tx_hash !== pendingTxHash;
    });
  },
};

const actions = {
  getNewBuyAddress({ rootGetters }, wallet) {
    let pubKeyAddress;
    _.mapKeys(rootGetters.getPubKeysBuy, (value, key) => {
      if (wallet.ticker.toLowerCase().indexOf(key) >= 0)  {
        pubKeyAddress = value;
      }
    });

    const xpub = bitcoinjs.HDNode.fromBase58(pubKeyAddress, wallet.coin.network);
    const index = Math.floor(Math.random() * 10);
    const address = xpub.derivePath(`0/${index}`).keyPair.getAddress();
    return address;
  },
  buyAsset({ commit, rootGetters, dispatch }, { wallet, inputs, outputs, amount, amountMnz, fee, dataScript }) {
    return dispatch('sendTransaction', { wallet, inputs, outputs, fee, dataScript })
      .then((sentTxId) => {
        const localCryptoTx = generateLocalTx(wallet.address, amount, sentTxId);
        const localMnzTx = generateLocalMnz(amountMnz);
        commit('ADD_PENDING_TX', { mnzTx: localMnzTx, cryptoTx: localCryptoTx, ticker: wallet.ticker });
        return sentTxId;
      })
    ;
  },
  buildSwapList({ commit, rootGetters }) {

    let cryptoTxs = [];
    let icoCoinTxs = [];
    _.map(rootGetters.enabledCoins, (coin) => {
      if (coin.ticker.indexOf('MNZ') < 0) {
        cryptoTxs = cryptoTxs.concat(rootGetters.getWalletByTicker(coin.ticker).txs);
      } else {
        icoCoinTxs = cryptoTxs.concat(rootGetters.getWalletByTicker(coin.ticker).txs);
      }
    });

    const associations = associateTxsFromWallet(cryptoTxs, icoCoinTxs);
    commit('UPDATE_ASSOCIATED_TXS', associations, { root: true });
  },
};

const associateTxsFromWallet = (cryptoTxs, mnzTxs) => {
  // console.log("mnzTxs: ", mnzTxs);
  const associateArray = [];
  if (cryptoTxs != null && mnzTxs != null) {
    _.forEach(mnzTxs, (mnzTx) => {
      if (mnzTx.origin != null) {
        const cryptoTxsForMnz = _.filter(cryptoTxs, (cryptoTx) => {
          if (cryptoTx.tx_hash.substring(0, 9) === mnzTx.origin.txHash) {
            return true;
          }
          return false;
        });
        if (cryptoTxsForMnz[0]) {
          associateArray.push({ mnzTx: mnzTx, cryptoTx: cryptoTxsForMnz[0], ticker: mnzTx.origin.ticker });
        }
      }
    });
  }
  return associateArray;
};

// key: 'cryptoTx.time',
// key: 'ticker',
// key: 'mnzTx',
// key: 'price41',
// key: 'price4all',
// key: 'status',

const getters = {
  icoIsOver: (state, getters) => {
    const config = getters.getConfig;
    if ((config.progress >= 1 || (moment.unix(config.icoStartDate) > moment() || moment() > moment.unix(config.icoEndDate)))) {
      return true;
    }
    return false;
  },
  icoWillBegin: (state, getters) => {
    const config = getters.getConfig;
    if (moment() < moment.unix(config.icoStartDate)) {
      return true;
    }
    return false;
  },
  icoStartDate: (state, getters) => {
    return getters.getConfig.icoStartDate;
  },
  getSwapList: (state) => {
    return state.pendingSwaps.concat(state.associatedTxs);
  },
  getSwapList2: (state, getters) => {
    return getters.getSwapList.map(swap => {
      return {
        time: swap.cryptoTx.time,
        ticker: swap.ticker,
        mnzAmount: swap.mnzTx.amount,
        cryptoAmount: swap.cryptoTx.amount,
        mnzTxHash: swap.mnzTx.tx_hash,
      };
    });
  },
};

const generateLocalTx = (address, amount, txHash) => {
  const nowDate = new Date();
  const now = (nowDate.getTime() / 1000) + (nowDate.getTimezoneOffset() * 60);

  return {
    address: address,
    amount: amount,
    time: now,
    tx_hash: txHash,
  };
};

const generateLocalMnz = (amount) => {
  return {
    amount: amount,
  };
};

export default {
  state,
  mutations,
  actions,
  getters,
};
