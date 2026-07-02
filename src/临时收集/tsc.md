<div class="center-container">
  <label class="main-toggle">
    <input class="main-checkbox" type="checkbox" />
    <div class="main-track"></div>
    <div class="main-knob"></div>
  </label>
</div>


.main-toggle {
  position: relative;
  display: block;
  width: 90px;
  height: 40px;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  margin-bottom: 3px;
  margin-right: 3px;
}

.main-checkbox {
  display: none;
}

.main-track {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #2ecc71;
  border: 4px solid #000000;
  box-sizing: border-box;
  box-shadow: inset 2px 2px 0 rgba(0, 0, 0, 0.1);
  transition: background-color 0.3s ease;
}

.main-knob {
  position: absolute;
  top: 50%;
  left: 0;
  transform: translate(-4px, -50%);

  width: 40px;
  height: 46px;

  background: white;
  border: 4px solid #000000;

  box-shadow: 3px 3px 0 #000000;

  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;

  transition: transform 0.3s cubic-bezier(0.7, -0.4, 0.4, 1.4);
}

.main-toggle:active .main-knob {
  box-shadow: 1px 1px 0 #000000;
  margin-top: 2px;
  margin-left: 2px;
}

.main-knob::after {
  content: ":)";
  font-weight: 900;
  font-size: 24px;
  color: black;
  transform: rotate(90deg);
}

.main-checkbox:checked + .main-track {
  background-color: #e74c3c;
}

.main-checkbox:checked ~ .main-knob {
  transform: translate(50px, -50%);
}

.main-checkbox:checked ~ .main-knob::after {
  content: ":(";
}
