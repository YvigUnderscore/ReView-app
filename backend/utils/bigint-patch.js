// Patch BigInt to be serializable as JSON (returns string)
BigInt.prototype.toJSON = function () {
  return this.toString();
};
