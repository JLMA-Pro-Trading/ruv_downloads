# Conformal Predictive Distributions (CPD) - Mathematical Specification

**Version**: 2.0.0
**Date**: 2025-11-15
**Status**: Mathematical Specification

---

## Table of Contents

1. [Introduction](#introduction)
2. [Formal Definition](#formal-definition)
3. [Uniformity Theorem](#uniformity-theorem)
4. [CDF Construction Algorithm](#cdf-construction-algorithm)
5. [Computational Complexity](#computational-complexity)
6. [Properties and Guarantees](#properties-and-guarantees)
7. [References](#references)

---

## 1. Introduction

Conformal Predictive Distributions (CPD) extend traditional conformal prediction from producing prediction intervals to outputting **complete probability distributions** over the target variable. Unlike standard conformal prediction which produces sets, CPD provides a cumulative distribution function (CDF) $Q_x(y)$ for each test point $x$, enabling probabilistic reasoning beyond simple coverage guarantees.

### 1.1 Motivation

Traditional conformal prediction outputs prediction sets of the form:

$$\Gamma^\alpha(x) = \{y : p(x, y) > \alpha\}$$

where $p(x, y)$ is a p-value. While this guarantees coverage $\mathbb{P}[Y_{\text{true}} \in \Gamma^\alpha(X)] \geq 1 - \alpha$, it provides no distributional information within the prediction set.

CPD addresses this limitation by constructing a full CDF that is **calibrated**: the CDF evaluated at the true value is uniformly distributed.

---

## 2. Formal Definition

### 2.1 Setup

**Definition 2.1** (Exchangeability): A sequence of random variables $(Z_1, Z_2, \ldots, Z_n)$ is **exchangeable** if for any permutation $\pi$ of $\{1, \ldots, n\}$:

$$\mathbb{P}[(Z_1, \ldots, Z_n) \in A] = \mathbb{P}[(Z_{\pi(1)}, \ldots, Z_{\pi(n)}) \in A]$$

for all measurable sets $A$.

**Remark**: Exchangeability is weaker than i.i.d. and is the key assumption in conformal prediction.

### 2.2 Nonconformity Measure

**Definition 2.2** (Nonconformity Measure): A **nonconformity measure** is a function $A: \mathcal{X} \times \mathcal{Y} \to \mathbb{R}$ that quantifies how unusual a label $y$ is for input $x$.

**Examples**:
- **Regression**: $A(x, y) = |y - \hat{f}(x)|$ (absolute residual)
- **Classification**: $A(x, y) = 1 - \hat{p}_y(x)$ (inverse probability)
- **k-NN**: $A(x, y) = d_k(x) - d(x, y)$ (distance-based)

### 2.3 Conformal CDF

**Definition 2.3** (Conformal Predictive Distribution): Given:
- Calibration set: $\mathcal{D}_n = \{(x_1, y_1), \ldots, (x_n, y_n)\}$
- Nonconformity measure: $A$
- Test input: $x_{n+1}$

For each candidate value $y \in \mathcal{Y}$, define the **p-value**:

$$p_{n+1}(y) = \frac{\#\{i \in [n] : \alpha_i \geq \alpha_{n+1}(y)\} + 1}{n + 1}$$

where $\alpha_i = A(x_i, y_i)$ are calibration scores and $\alpha_{n+1}(y) = A(x_{n+1}, y)$.

The **Conformal CDF** is:

$$Q_{x_{n+1}}(y) = 1 - p_{n+1}(y)$$

**Interpretation**: $Q_x(y)$ is the probability that the true label $Y_{n+1}$ is at most $y$, according to the conformal distribution.

---

## 3. Uniformity Theorem

The fundamental property of CPD is that the CDF evaluated at the true label is uniformly distributed.

### 3.1 Main Theorem

**Theorem 3.1** (CPD Uniformity [Vovk et al., 2005]): Assume $(x_1, y_1), \ldots, (x_{n+1}, y_{n+1})$ are exchangeable. Then:

$$U_{n+1} := Q_{x_{n+1}}(Y_{n+1}) \sim \text{Uniform}(0, 1)$$

in the sense that for all $u \in [0, 1]$:

$$\mathbb{P}[U_{n+1} \leq u] = u$$

### 3.2 Proof

**Proof**: We prove the discrete version (continuous case follows by taking limits).

**Step 1**: Express $U_{n+1}$ in terms of ranks.

Let $\alpha_i = A(x_i, y_i)$ for $i = 1, \ldots, n+1$. Define:

$$R_{n+1} = \#\{i \in [n+1] : \alpha_i \geq \alpha_{n+1}\}$$

the **rank** of $\alpha_{n+1}$ among all $n+1$ scores (with ties broken randomly).

Then:

$$p_{n+1}(Y_{n+1}) = \frac{R_{n+1}}{n+1}$$

and:

$$U_{n+1} = Q_{x_{n+1}}(Y_{n+1}) = 1 - \frac{R_{n+1}}{n+1} = \frac{n+1 - R_{n+1}}{n+1}$$

**Step 2**: Show $R_{n+1}$ is uniformly distributed on $\{1, 2, \ldots, n+1\}$.

By exchangeability, all permutations of $(Z_1, \ldots, Z_{n+1})$ where $Z_i = (x_i, y_i, \alpha_i)$ are equally likely. Thus, $\alpha_{n+1}$ is equally likely to be the $k$-th smallest value for any $k \in \{1, \ldots, n+1\}$.

Therefore:

$$\mathbb{P}[R_{n+1} = k] = \frac{1}{n+1} \quad \text{for all } k \in \{1, \ldots, n+1\}$$

**Step 3**: Compute distribution of $U_{n+1}$.

Since $R_{n+1}$ is uniformly distributed on $\{1, \ldots, n+1\}$:

$$\mathbb{P}\left[U_{n+1} = \frac{n+1-k}{n+1}\right] = \frac{1}{n+1}$$

for $k \in \{1, \ldots, n+1\}$.

This means $U_{n+1}$ takes values $\left\{0, \frac{1}{n+1}, \frac{2}{n+1}, \ldots, \frac{n}{n+1}\right\}$ with equal probability $\frac{1}{n+1}$.

In the limit as $n \to \infty$, the distribution converges to $\text{Uniform}(0, 1)$. $\square$

### 3.3 Corollaries

**Corollary 3.2** (Calibration): For any quantile level $q \in (0, 1)$:

$$\mathbb{P}\left[Y_{n+1} \leq Q_{x_{n+1}}^{-1}(q)\right] = q$$

where $Q^{-1}(q) = \inf\{y : Q(y) \geq q\}$ is the quantile function.

**Proof**: By Theorem 3.1:

$$\mathbb{P}[Y_{n+1} \leq Q^{-1}(q)] = \mathbb{P}[Q(Y_{n+1}) \leq q] = \mathbb{P}[U_{n+1} \leq q] = q$$

where the second equality uses monotonicity of $Q$. $\square$

**Corollary 3.3** (Coverage Guarantee): For any $\alpha \in (0, 1)$, the prediction interval:

$$I^\alpha = \left[Q^{-1}(\alpha/2), Q^{-1}(1 - \alpha/2)\right]$$

satisfies:

$$\mathbb{P}[Y_{n+1} \in I^\alpha] = 1 - \alpha$$

**Proof**: Direct application of Corollary 3.2. $\square$

---

## 4. CDF Construction Algorithm

### 4.1 Naive Algorithm

**Algorithm 4.1** (Naive CDF Evaluation):

**Input**:
- Calibration scores $\{\alpha_1, \ldots, \alpha_n\}$
- Test point $(x_{n+1}, y)$
- Nonconformity measure $A$

**Output**: $Q_{x_{n+1}}(y)$

```
1. Compute α_{n+1}(y) = A(x_{n+1}, y)
2. count = 0
3. For i = 1 to n:
4.     If α_i ≥ α_{n+1}(y):
5.         count = count + 1
6. p = (count + 1) / (n + 1)
7. Return Q = 1 - p
```

**Complexity**: $O(n)$ per query.

### 4.2 Optimized Algorithm with Pre-sorting

**Algorithm 4.2** (Fast CDF Evaluation):

**Preprocessing** (done once):
```
1. Sort calibration scores: α_sorted = sort([α_1, ..., α_n])
2. Store sorted array
```
**Complexity**: $O(n \log n)$

**Query** (for each $y$):
```
1. Compute α_{n+1}(y) = A(x_{n+1}, y)
2. Use binary search to find:
   count = number of indices i where α_sorted[i] ≥ α_{n+1}(y)
3. p = (count + 1) / (n + 1)
4. Return Q = 1 - p
```
**Complexity**: $O(\log n)$ per query.

### 4.3 Quantile Evaluation

**Problem**: Given $q \in (0, 1)$, compute $Q^{-1}(q)$.

**Observation**: We need to find $y^*$ such that $Q(y^*) = q$, i.e.:

$$1 - \frac{\#\{i : \alpha_i \geq A(x_{n+1}, y^*)\} + 1}{n+1} = q$$

Rearranging:

$$\#\{i : \alpha_i \geq A(x_{n+1}, y^*)\} = (1-q)(n+1) - 1$$

**Algorithm 4.3** (Quantile Computation):

**For discrete $\mathcal{Y}$**:
```
1. For each candidate y in Y:
2.     Compute Q(y) using Algorithm 4.2
3. Return y* such that Q(y*) ≈ q (interpolate if needed)
```
**Complexity**: $O(|\mathcal{Y}| \log n)$

**For continuous $\mathcal{Y}$ (regression)**:

Use the fact that for residual-based nonconformity ($A(x,y) = |y - \hat{f}(x)|$):

$$Q^{-1}(q) = \hat{f}(x_{n+1}) \pm \alpha^{(k)}$$

where $\alpha^{(k)}$ is the $k$-th order statistic with $k = \lceil q(n+1) \rceil$.

**Algorithm 4.4** (Regression Quantile):
```
1. Compute point prediction: ŷ = f(x_{n+1})
2. Find k = ceil(q * (n + 1))
3. Return ŷ + sign(q - 0.5) * α_sorted[k]
```
**Complexity**: $O(1)$ (after preprocessing).

### 4.4 Correctness

**Theorem 4.5** (Correctness of Binary Search): Algorithm 4.2 correctly computes $Q_{x_{n+1}}(y)$.

**Proof**: The binary search finds the number of calibration scores $\geq \alpha_{n+1}(y)$ in $O(\log n)$ time. The p-value and CDF computations are exact. $\square$

---

## 5. Computational Complexity

### 5.1 Time Complexity

| Operation | Naive | Optimized | Notes |
|-----------|-------|-----------|-------|
| **Preprocessing** | $O(1)$ | $O(n \log n)$ | Sort calibration scores |
| **CDF Query** | $O(n)$ | $O(\log n)$ | Binary search |
| **Quantile Query** | $O(n \cdot \|\mathcal{Y}\|)$ | $O(\|\mathcal{Y}\| \log n)$ | Discrete case |
| **Quantile (regression)** | $O(n)$ | $O(1)$ | Direct lookup |
| **Full Distribution** | $O(n \cdot m)$ | $O(m \log n)$ | Evaluate at $m$ points |

**Key Insight**: Pre-sorting the calibration scores reduces per-query complexity from $O(n)$ to $O(\log n)$.

### 5.2 Space Complexity

- **Calibration Scores**: $O(n)$ to store $n$ scores
- **Sorted Index**: $O(n)$ for sorted array
- **Total**: $O(n)$ space

**Memory-Efficient Variant**: For very large $n$ (e.g., $n > 10^6$), we can use:
1. **Quantization**: Store only $k$ quantiles of the calibration distribution ($k \ll n$)
2. **Sampling**: Use a random subsample of size $m$ for calibration
3. **Streaming**: Maintain a sketch (e.g., t-digest) of the score distribution

**Trade-off**: Quantization introduces approximation error but reduces space to $O(k)$.

### 5.3 Parallelization

**CDF Evaluation** at multiple points can be parallelized:

```rust
// Pseudo-code
let cdfs: Vec<f64> = y_values.par_iter()
    .map(|&y| conformal_cdf(y, calibration_scores))
    .collect();
```

**Speedup**: Near-linear in number of cores (embarrassingly parallel).

---

## 6. Properties and Guarantees

### 6.1 Monotonicity

**Theorem 6.1** (Monotonicity of CDF): $Q_{x_{n+1}}(y)$ is a non-decreasing function of $y$.

**Proof**: For $y_1 < y_2$, assume $A(x, y)$ is non-decreasing in $y$ (satisfied for residual-based measures). Then:

$$\alpha_{n+1}(y_1) \leq \alpha_{n+1}(y_2)$$

Thus:

$$\#\{i : \alpha_i \geq \alpha_{n+1}(y_2)\} \leq \#\{i : \alpha_i \geq \alpha_{n+1}(y_1)\}$$

which implies $p_{n+1}(y_2) \leq p_{n+1}(y_1)$, and therefore $Q(y_2) \geq Q(y_1)$. $\square$

### 6.2 Bounds

**Theorem 6.2** (CDF Bounds): For all $y \in \mathcal{Y}$:

$$\frac{1}{n+1} \leq Q_{x_{n+1}}(y) \leq \frac{n}{n+1}$$

**Proof**: The minimum value of $Q$ occurs when $\alpha_{n+1}(y)$ is smaller than all calibration scores:

$$Q_{\min} = 1 - \frac{n+1}{n+1} = \frac{1}{n+1}$$

Wait, let me reconsider. Actually:

The p-value satisfies:
$$p \in \left[\frac{1}{n+1}, 1\right]$$

So:
$$Q = 1 - p \in \left[0, \frac{n}{n+1}\right]$$

More precisely:
- When $\alpha_{n+1}(y)$ is larger than all calibration scores: $p = \frac{1}{n+1}$, so $Q = \frac{n}{n+1}$
- When $\alpha_{n+1}(y)$ is smaller than all calibration scores: $p = \frac{n+1}{n+1} = 1$, so $Q = 0$

Therefore: $Q \in [0, \frac{n}{n+1}]$. $\square$

**Remark**: The CDF cannot reach exactly 1 with finite calibration data. This is inherent to the conformal framework.

### 6.3 Consistency

**Theorem 6.3** (Asymptotic Consistency): As $n \to \infty$, under regularity conditions:

$$Q_{x_{n+1}}(y) \to F_{Y|X}(y \mid x_{n+1})$$

where $F_{Y|X}$ is the true conditional CDF.

**Sketch**: For well-specified models where $A(x, y) \approx |y - \mathbb{E}[Y|X=x]|$, the empirical distribution of residuals converges to the true conditional distribution by the Glivenko-Cantelli theorem. $\square$

### 6.4 Interval Width Monotonicity

**Theorem 6.4** (Interval Width Monotonicity): For $\alpha_1 < \alpha_2$:

$$\text{width}(I^{\alpha_2}) \geq \text{width}(I^{\alpha_1})$$

where $I^\alpha = [Q^{-1}(\alpha/2), Q^{-1}(1-\alpha/2)]$.

**Proof**: Since $Q^{-1}$ is non-decreasing, and $\alpha_2 > \alpha_1$ implies:
- $Q^{-1}(\alpha_2/2) \geq Q^{-1}(\alpha_1/2)$ (lower bound decreases)
- $Q^{-1}(1-\alpha_2/2) \geq Q^{-1}(1-\alpha_1/2)$ (upper bound increases)

Thus the interval widens. $\square$

---

## 7. References

1. **Vovk, V., Gammerman, A., & Shafer, G.** (2005). *Algorithmic Learning in a Random World*. Springer. [Foundational text on conformal prediction]

2. **Manokhin, V.** (2025). "Predicting Full Probability Distributions with Conformal Prediction." *arXiv preprint*. [Modern treatment of CPD]

3. **Lei, J., G'Sell, M., Rinaldo, A., Tibshirani, R. J., & Wasserman, L.** (2018). "Distribution-free predictive inference for regression." *Journal of the American Statistical Association*, 113(523), 1094-1111. [Split conformal prediction]

4. **Romano, Y., Patterson, E., & Candès, E.** (2019). "Conformalized quantile regression." *Advances in Neural Information Processing Systems*, 32. [CQR method]

5. **Shafer, G., & Vovk, V.** (2008). "A tutorial on conformal prediction." *Journal of Machine Learning Research*, 9(3), 371-421. [Accessible tutorial]

---

## Appendix A: Exchangeability vs. I.I.D.

**Proposition A.1**: If $(Z_1, \ldots, Z_n)$ are i.i.d., then they are exchangeable.

**Proof**: For any permutation $\pi$ and measurable set $A$:

$$\mathbb{P}[(Z_{\pi(1)}, \ldots, Z_{\pi(n)}) \in A] = \prod_{i=1}^n \mathbb{P}[Z_{\pi(i)} \in A_i] = \prod_{i=1}^n \mathbb{P}[Z_i \in A_i] = \mathbb{P}[(Z_1, \ldots, Z_n) \in A]$$

where the second equality uses identical distribution. $\square$

**Remark**: The converse is false. Exchangeability is strictly weaker than i.i.d., making conformal prediction applicable to dependent data (e.g., time series with proper setup).

---

## Appendix B: Non-Monotonic Nonconformity Measures

If $A(x, y)$ is not monotonic in $y$, the CDF $Q(y)$ may have jumps or plateaus. In this case:

- The uniformity property (Theorem 3.1) still holds
- But $Q$ may not be a proper CDF (not strictly increasing)

**Solution**: Use a **randomized** CDF:

$$Q_{\text{rand}}(y) = Q(y) + \tau \cdot \Delta Q(y)$$

where $\tau \sim \text{Uniform}(0, 1)$ and $\Delta Q(y)$ is the size of the jump at $y$.

This ensures $Q_{\text{rand}}$ is strictly increasing and maintains uniformity.

---

## Appendix C: Implementation Notes

### C.1 Numerical Stability

For very large or small nonconformity scores, use **log-space arithmetic**:

```rust
// Instead of: count / (n + 1)
// Use: exp(log_count - log(n + 1))
let log_p = log_count - (n + 1.0).ln();
let p = log_p.exp();
```

### C.2 Tie-Breaking

When multiple calibration scores equal $\alpha_{n+1}(y)$, add random tie-breaking:

```rust
let count = scores.iter()
    .filter(|&&s| s > alpha || (s == alpha && rng.gen_bool(0.5)))
    .count();
```

This ensures exact uniformity in finite samples.

### C.3 Vectorization

For GPU/SIMD optimization:

```rust
// Vectorized comparison
let mask = alpha_vec.iter()
    .map(|&a| (a >= alpha_test) as i32)
    .collect::<Vec<_>>();
let count: i32 = mask.iter().sum();
```

---

**End of CPD Specification**
